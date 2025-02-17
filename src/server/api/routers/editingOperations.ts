import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { findDifferences } from "~/lib/functions";
import {
  deletePattern,
  generateMovements,
  getAllEntities,
  logIO,
  undoMovements,
} from "~/lib/trpcFunctions";
import { currentAccountOnlyTypes } from "~/lib/variables";
import {
  Status,
  entities,
  operations,
  transactions,
  transactionsMetadata,
} from "~/server/db/schema";
import { createTRPCRouter, protectedLoggedProcedure } from "../trpc";

export const editingOperationsRouter = createTRPCRouter({
  updateTransactionValues: protectedLoggedProcedure
    .input(
      z.object({
        txId: z.number().int(),
        txType: z.string(),
        newTransactionData: z.object({
          fromEntityId: z.number(),
          toEntityId: z.number(),
          operatorEntityId: z.number(),
          currency: z.string(),
          amount: z.number(),
        }),
        oldTransactionData: z.object({
          fromEntityId: z.number(),
          toEntityId: z.number(),
          operatorEntityId: z.number(),
          currency: z.string(),
          amount: z.number(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        input.txType === "cuenta corriente" &&
        ctx.user.email !== "christian@ifc.com.ar" &&
        ctx.user.email !== "tomas.castelli@ifc.com.ar"
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: `User with email: ${ctx.user.email} is not authorized to update current account transactions`,
        });
      }
      const response = await ctx.db.transaction(
        async (transaction) => {
          const [historyResponse2] = await transaction
            .select({ history: transactionsMetadata.history })
            .from(transactionsMetadata)
            .where(eq(transactionsMetadata.transactionId, input.txId));

          const oldHistoryJson2 = historyResponse2?.history;

          const changesMade = findDifferences(
            input.oldTransactionData,
            input.newTransactionData,
            ctx.user.id,
          );

          // @ts-ignore
          let newHistoryJson2 = [];

          if (
            oldHistoryJson2 &&
            typeof oldHistoryJson2 === "object" &&
            Array.isArray(oldHistoryJson2)
          ) {
            newHistoryJson2 = [...oldHistoryJson2, changesMade];
          } else if (oldHistoryJson2 !== undefined) {
            newHistoryJson2 = [changesMade];
          }

          const [newTxObj] = await transaction
            .update(transactions)
            .set({
              fromEntityId: input.newTransactionData.fromEntityId,
              toEntityId: input.newTransactionData.toEntityId,
              operatorEntityId: input.newTransactionData.operatorEntityId,
              currency: input.newTransactionData.currency,
              amount: input.newTransactionData.amount,
            })
            .where(eq(transactions.id, input.txId))
            .returning({
              id: transactions.id,
              operationId: transactions.operationId,
            });

          if (!newTxObj) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Transaction to update not found",
            });
          }
          await transaction
            .update(transactionsMetadata)
            .set({
              // @ts-ignore
              history: newHistoryJson2,
            })
            .where(eq(transactionsMetadata.transactionId, input.txId));

          const entitiesData = await getAllEntities(ctx.redis, ctx.db);

          const toEntityObj = entitiesData.find(
            (e) => e.id === input.oldTransactionData.toEntityId,
          );

          const fromEntityObj = entitiesData.find(
            (e) => e.id === input.oldTransactionData.fromEntityId,
          );

          if (!toEntityObj) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `La entidad con ID ${input.oldTransactionData.toEntityId} no fue encontrada`,
            });
          }
          if (!fromEntityObj) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `La entidad con ID ${input.oldTransactionData.fromEntityId} no fue encontrada`,
            });
          }

          const deletedMovements = await undoMovements(
            transaction,
            {
              id: newTxObj.id,
              fromEntity: {
                id: fromEntityObj.id,
                tagName: fromEntityObj.tag.name,
              },
              toEntity: { id: toEntityObj.id, tagName: toEntityObj.tag.name },
              currency: input.oldTransactionData.currency,
              amount: input.oldTransactionData.amount,
            },
            ctx.redlock,
          );

          const fromEntity = alias(entities, "fromEntity");
          const toEntity = alias(entities, "toEntity");

          const [newTxResponse] = await transaction
            .select()
            .from(transactions)
            .leftJoin(fromEntity, eq(transactions.fromEntityId, fromEntity.id))
            .leftJoin(toEntity, eq(transactions.toEntityId, toEntity.id))
            .leftJoin(operations, eq(transactions.operationId, operations.id))
            .where(eq(transactions.id, newTxObj.id));

          const txForMovement = {
            ...newTxResponse!.Transactions,
            fromEntity: newTxResponse!.fromEntity!,
            toEntity: newTxResponse!.toEntity!,
            operation: newTxResponse!.Operations!,
          };

          const filteredMovements = deletedMovements.filter(
            (mv) => mv.entitiesMovementId === null,
          );

          // Filtro para loopear los movimientos originales, no los que hacen referencia a los originales
          for (const deletedMovement of filteredMovements) {
            await generateMovements(
              transaction,
              txForMovement,
              deletedMovement.account,
              deletedMovement.direction,
              deletedMovement.type,
              ctx.redlock,
            );
          }

          return newTxResponse!.Transactions;
        },
        {
          isolationLevel: "serializable",
          deferrable: true,
        },
      );

      if (response) {
        await logIO(
          ctx.dynamodb,
          ctx.user.id,
          "Actualizar transacción",
          input,
          response,
        );
      }
      return response;
    }),

  updateTransactionStatus: protectedLoggedProcedure
    .input(
      z.object({
        transactionIds: z.array(z.number().int()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.db.transaction(async (transaction) => {
        const confirmedTxs = [];

        const fromEntity = alias(entities, "fromEntity");
        const toEntity = alias(entities, "toEntity");

        for (const txId of input.transactionIds) {
          const [transactionData] = await transaction
            .select()
            .from(transactions)
            .leftJoin(fromEntity, eq(transactions.fromEntityId, fromEntity.id))
            .leftJoin(toEntity, eq(transactions.toEntityId, toEntity.id))
            .leftJoin(operations, eq(transactions.operationId, operations.id))
            .where(eq(transactions.id, txId));

          if (!transactionData || !transactionData.Operations) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Transaction ${txId} does not exist`,
            });
          }

          if (
            transactionData.Transactions.status !== Status.enumValues[2] ||
            currentAccountOnlyTypes.has(transactionData.Transactions.type)
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "This transaction cannot be confirmed",
            });
          }
          await transaction
            .update(transactions)
            .set({
              status: "confirmed",
            })
            .where(eq(transactions.id, txId));

          await transaction
            .update(transactionsMetadata)
            .set({
              confirmedBy: ctx.user.id,
              confirmedDate: new Date(),
            })
            .where(eq(transactionsMetadata.transactionId, txId));

          const mappedTransaction = {
            ...transactionData.Transactions,
            operation: { date: transactionData.Operations.date },
            fromEntity: transactionData.fromEntity!,
            toEntity: transactionData.toEntity!,
          };

          await generateMovements(
            transaction,
            mappedTransaction,
            false,
            1,
            "confirmation",
            ctx.redlock,
          );
          await generateMovements(
            transaction,
            mappedTransaction,
            true,
            1,
            "confirmation",
            ctx.redlock,
          );

          confirmedTxs.push(mappedTransaction.id);
        }

        return confirmedTxs;
      });

      await logIO(
        ctx.dynamodb,
        ctx.user.id,
        "Confirmar transacción",
        input,
        response,
      );

      return response;
    }),
  cancelTransaction: protectedLoggedProcedure
    .input(
      z.object({
        transactionsId: z.array(z.number().int()).optional(),
        operationId: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.db.transaction(async (transaction) => {
        const transactionsToCancel =
          await transaction.query.transactions.findMany({
            where: and(
              input.transactionsId
                ? inArray(transactions.id, input.transactionsId)
                : undefined,
              input.operationId
                ? eq(transactions.operationId, input.operationId)
                : undefined,
            ),
            with: {
              operation: true,
              movements: true,
              fromEntity: true,
              toEntity: true,
            },
          });

        // Transaction cancellation
        await transaction
          .update(transactions)
          .set({ status: Status.enumValues[0] })
          .where(
            inArray(
              transactions.id,
              transactionsToCancel.map((tx) => tx.id),
            ),
          );

        if (input.transactionsId) {
          await transaction
            .update(transactionsMetadata)
            .set({
              cancelledBy: ctx.user.id,
              cancelledDate: new Date(),
            })
            .where(
              inArray(transactionsMetadata.transactionId, input.transactionsId),
            );
        } else if (input.operationId) {
          const relatedTxIds = await transaction
            .select({ id: transactions.id })
            .from(transactions)
            .where(eq(transactions.operationId, input.operationId));
          await transaction
            .update(transactionsMetadata)
            .set({
              cancelledBy: ctx.user.id,
              cancelledDate: new Date(),
            })
            .where(
              inArray(
                transactionsMetadata.transactionId,
                relatedTxIds.map((obj) => obj.id),
              ),
            );
        }

        // Para cancelar, vamos a crear los mismos movimientos con los datos de la transaccion invertidos
        for (const tx of transactionsToCancel) {
          for (const mv of tx.movements.filter(
            (m) => m.entitiesMovementId === null,
          )) {
            await generateMovements(
              transaction,
              tx,
              mv.account,
              mv.direction * -1,
              "cancellation",
              ctx.redlock,
            );
          }
        }

        return transactionsToCancel;
      });

      await logIO(
        ctx.dynamodb,
        ctx.user.id,
        "Cancelar transacciones",
        input,
        response,
      );

      return response;
    }),
  changeOpData: protectedLoggedProcedure
    .input(
      z.object({
        opId: z.number(),
        opObservations: z.string().optional(),
        opDate: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.db.transaction(
        async (transaction) => {
          const [updatedOperation] = await transaction
            .update(operations)
            .set({ observations: input.opObservations, date: input.opDate })
            .where(eq(operations.id, input.opId))
            .returning();

          if (input.opDate) {
            const fromEntity = alias(entities, "fromEntity");
            const toEntity = alias(entities, "toEntity");
            const relatedTxs = await transaction
              .select()
              .from(transactions)
              .leftJoin(
                fromEntity,
                eq(fromEntity.id, transactions.fromEntityId),
              )
              .leftJoin(toEntity, eq(toEntity.id, transactions.toEntityId))
              .where(eq(transactions.operationId, input.opId));

            for (const relatedTx of relatedTxs) {
              const deletedMvs = await undoMovements(
                transaction,
                {
                  ...relatedTx.Transactions,
                  fromEntity: relatedTx.fromEntity!,
                  toEntity: relatedTx.toEntity!,
                },
                ctx.redlock,
              );

              const filteredMovements = deletedMvs.filter(
                (mv) => mv.entitiesMovementId === null,
              );

              for (const deletedMv of filteredMovements) {
                await generateMovements(
                  transaction,
                  {
                    ...relatedTx.Transactions,
                    fromEntity: relatedTx.fromEntity!,
                    toEntity: relatedTx.toEntity!,
                    operation: { date: input.opDate },
                  },
                  deletedMv.account,
                  deletedMv.direction,
                  deletedMv.type,
                  ctx.redlock,
                );
              }
            }
          }

          return updatedOperation;
        },
        {
          isolationLevel: "serializable",
          deferrable: true,
        },
      );

      return response;
    }),
  deleteEntityOperations: protectedLoggedProcedure
    .input(
      z.object({
        entityId: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        ctx.user.email !== "christian@ifc.com.ar" &&
        ctx.user.email !== "tomas.castelli@ifc.com.ar"
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: `User with email: ${ctx.user.email} is not authorized to delete entities`,
        });
      }

      const response = await ctx.db.transaction(
        async (transaction) => {
          // Get all operations where the entity is involved
          const relatedOperations = await transaction
            .select()
            .from(operations)
            .innerJoin(
              transactions,
              eq(transactions.operationId, operations.id),
            )
            .where(
              or(
                eq(transactions.fromEntityId, input.entityId),
                eq(transactions.toEntityId, input.entityId),
                eq(transactions.operatorEntityId, input.entityId),
              ),
            );

          // For each operation
          for (const operation of relatedOperations) {
            // Get all transactions for this operation
            const fromEntity = alias(entities, "fromEntity");
            const toEntity = alias(entities, "toEntity");
            const operationTxs = await transaction
              .select()
              .from(transactions)
              .where(eq(transactions.operationId, operation.Operations.id))
              .leftJoin(
                fromEntity,
                eq(transactions.fromEntityId, fromEntity.id),
              )
              .leftJoin(toEntity, eq(transactions.toEntityId, toEntity.id));

            // Undo movements for each transaction
            for (const tx of operationTxs) {
              await undoMovements(
                transaction,
                {
                  ...tx.Transactions,
                  fromEntity: tx.fromEntity!,
                  toEntity: tx.toEntity!,
                },
                ctx.redlock,
              );
            }

            // Delete transactions metadata
            await transaction.delete(transactionsMetadata).where(
              inArray(
                transactionsMetadata.transactionId,
                operationTxs.map((tx) => tx.Transactions.id),
              ),
            );

            // Delete transactions
            await transaction
              .delete(transactions)
              .where(eq(transactions.operationId, operation.Operations.id));

            // Delete operation
            await transaction
              .delete(operations)
              .where(eq(operations.id, operation.Operations.id));
          }

          // Finally delete the entity
          await transaction
            .delete(entities)
            .where(eq(entities.id, input.entityId));

          await deletePattern(ctx.redis, "entities*");

          return { success: true, deletedOperations: relatedOperations.length };
        },
        {
          isolationLevel: "serializable",
          deferrable: true,
        },
      );

      await logIO(
        ctx.dynamodb,
        ctx.user.id,
        "Eliminar operaciones de entidad",
        input,
        response,
      );

      return response;
    }),
});
