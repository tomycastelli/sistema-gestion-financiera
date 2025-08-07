import { TRPCError } from "@trpc/server";
import { and, eq, inArray, not, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { findDifferences } from "~/lib/functions";
import { generateMovements } from "~/lib/generateMovements";
import { deletePattern, getAllEntities, logIO } from "~/lib/trpcFunctions";
import { undoMovements } from "~/lib/undoMovements";
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
          category: z.string().optional(),
          subCategory: z.string().optional(),
        }),
        oldTransactionData: z.object({
          fromEntityId: z.number(),
          toEntityId: z.number(),
          operatorEntityId: z.number(),
          currency: z.string(),
          amount: z.number(),
          category: z.string().optional(),
          subCategory: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const lock = await ctx.redlock.acquire(
        [`EDITING_TRANSACTION_${input.txId}`],
        100_000,
      );
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
      if (
        input.newTransactionData.fromEntityId ===
        input.newTransactionData.toEntityId
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "From and to entities cannot be the same",
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
              category: input.newTransactionData.category,
              subCategory: input.newTransactionData.subCategory,
            })
            .where(eq(transactions.id, input.txId))
            .returning();

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

          const newFromEntity = entitiesData.find(
            (e) => e.id === newTxObj.fromEntityId,
          )!;
          const newToEntity = entitiesData.find(
            (e) => e.id === newTxObj.toEntityId,
          )!;

          const [operation] = await transaction
            .select()
            .from(operations)
            .where(eq(operations.id, newTxObj.operationId));

          const newTxForMovement = {
            ...newTxObj,
            fromEntity: {
              id: newFromEntity.id,
              tagName: newFromEntity.tag.name,
            },
            toEntity: {
              id: newToEntity.id,
              tagName: newToEntity.tag.name,
            },
            operation: operation!,
          };

          // Filtro para loopear los movimientos originales, no los que hacen referencia a los originales
          for (const deletedMovement of deletedMovements) {
            await generateMovements(
              transaction,
              newTxForMovement,
              deletedMovement.account,
              deletedMovement.direction,
              deletedMovement.type,
              ctx.redlock,
            );
          }

          await lock.release();

          return newTxObj;
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
      const lock = await ctx.redlock.acquire(
        input.transactionIds.map((id) => `EDITING_TRANSACTION_${id}`),
        100_000,
      );
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
              status: Status.enumValues[1],
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

      await lock.release();

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
              not(eq(transactions.status, Status.enumValues[0])),
            ),
            with: {
              operation: true,
              movements: true,
              fromEntity: true,
              toEntity: true,
            },
          });

        if (transactionsToCancel.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Estas trasnacciones ya fueron canceladas",
          });
        }

        // Acquire locks for the actual transactions that will be canceled
        const lockKeys = [
          ...transactionsToCancel.map((tx) => `EDITING_TRANSACTION_${tx.id}`),
          ...(input.operationId
            ? [`EDITING_OPERATION_${input.operationId}`]
            : []),
        ];
        const lock = await ctx.redlock.acquire(lockKeys, 30_000);

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
          for (const mv of tx.movements) {
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

        await lock.release();

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
      const lock = await ctx.redlock.acquire(
        [`EDITING_OPERATION_${input.opId}`],
        30_000,
      );
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

              for (const deletedMv of deletedMvs) {
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

      await lock.release();

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

          // Acquire locks for all affected operations
          const operationLocks = relatedOperations.map(
            (op) => `EDITING_OPERATION_${op.Operations.id}`,
          );
          const lock = await ctx.redlock.acquire(operationLocks, 30_000);

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

            // Undo movements for each transaction involving the entity
            const involvedTxs = operationTxs.filter(
              (tx) =>
                tx.Transactions.fromEntityId === input.entityId ||
                tx.Transactions.toEntityId === input.entityId ||
                tx.Transactions.operatorEntityId === input.entityId,
            );
            for (const tx of involvedTxs) {
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
                involvedTxs.map((tx) => tx.Transactions.id),
              ),
            );

            // Delete transactions
            await transaction.delete(transactions).where(
              inArray(
                transactions.id,
                involvedTxs.map((tx) => tx.Transactions.id),
              ),
            );

            // Delete operation if involvedTxs are all the transactions it had
            if (operationTxs.length === involvedTxs.length) {
              await transaction
                .delete(operations)
                .where(eq(operations.id, operation.Operations.id));
            }
          }

          // Finally delete the entity
          await transaction
            .delete(entities)
            .where(eq(entities.id, input.entityId));

          await deletePattern(ctx.redis, "entities*");

          await lock.release();

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
  migrateEntities: protectedLoggedProcedure
    .input(
      z.object({
        originEntityId: z.number().int(),
        originEntityTag: z.string(),
        destinationEntityId: z.number().int(),
        destinationEntityTag: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        !ctx.user.permissions?.some(
          (p) =>
            p.name === "ADMIN" ||
            p.name === "ENTITIES_MANAGE" ||
            (p.name === "ENTITIES_MANAGE_SOME" &&
              (p.entitiesIds?.includes(input.originEntityId) ||
                p.entitiesTags?.includes(input.originEntityTag))),
        )
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User does not have permission to migrate entities",
        });
      }
      // Chequeamos que no tengan transacciones entre sí
      const conflictingTransactions = await ctx.db
        .select({
          id: transactions.id,
        })
        .from(transactions)
        .where(
          or(
            and(
              eq(transactions.fromEntityId, input.originEntityId),
              eq(transactions.toEntityId, input.destinationEntityId),
            ),
            and(
              eq(transactions.fromEntityId, input.destinationEntityId),
              eq(transactions.toEntityId, input.originEntityId),
            ),
          ),
        );

      if (conflictingTransactions.length > 0) {
        throw new TRPCError({
          message: "Contains transactions between these two entities",
          code: "UNPROCESSABLE_CONTENT",
        });
      }

      return await ctx.db.transaction(async (tx) => {
        const [newEntityTxsFrom, newEntityTxsTo] = await Promise.all([
          tx
            .update(transactions)
            .set({
              fromEntityId: input.destinationEntityId,
            })
            .where(eq(transactions.fromEntityId, input.originEntityId))
            .returning({ id: transactions.id }),
          tx
            .update(transactions)
            .set({
              toEntityId: input.destinationEntityId,
            })
            .where(eq(transactions.toEntityId, input.originEntityId))
            .returning({ id: transactions.id }),
        ]);

        // Acquire locks for all affected transactions
        const allAffectedTxIds = [...newEntityTxsFrom, ...newEntityTxsTo].map(
          (t) => t.id,
        );
        const lock = await ctx.redlock.acquire(
          allAffectedTxIds.map((id) => `EDITING_TRANSACTION_${id}`),
          30_000,
        );

        const fromEntity = alias(entities, "fromEntity");
        const toEntity = alias(entities, "toEntity");

        const newEntityTxIds = [...newEntityTxsFrom, ...newEntityTxsTo].map(
          (t) => t.id,
        );

        const newEntityTxs = await tx
          .select()
          .from(transactions)
          .where(inArray(transactions.id, newEntityTxIds))
          .leftJoin(operations, eq(transactions.operationId, operations.id))
          .leftJoin(fromEntity, eq(fromEntity.id, transactions.fromEntityId))
          .leftJoin(toEntity, eq(toEntity.id, transactions.toEntityId));

        for (const newEntityTx of newEntityTxs) {
          // Chequeamos donde se encuentra la nueva destination entity y la cambiamos por la origin
          const isFrom =
            newEntityTx.fromEntity!.id === input.destinationEntityId;
          // Undo los movimientos de esas transacciones
          const deletedMovements = await undoMovements(
            tx,
            {
              id: newEntityTx.Transactions.id,
              fromEntity: {
                id: isFrom ? input.originEntityId : newEntityTx.fromEntity!.id,
                tagName: isFrom
                  ? input.originEntityTag
                  : newEntityTx.fromEntity!.tagName,
              },
              toEntity: {
                id: isFrom ? newEntityTx.toEntity!.id : input.originEntityId,
                tagName: isFrom
                  ? newEntityTx.toEntity!.tagName
                  : input.originEntityTag,
              },
              currency: newEntityTx.Transactions.currency,
              amount: newEntityTx.Transactions.amount,
            },
            ctx.redlock,
          );

          const newTxForMovement = {
            ...newEntityTx.Transactions,
            fromEntity: {
              id: newEntityTx.fromEntity!.id,
              tagName: newEntityTx.fromEntity!.tagName,
            },
            toEntity: {
              id: newEntityTx.toEntity!.id,
              tagName: newEntityTx.toEntity!.tagName,
            },
            operation: {
              date: newEntityTx.Operations!.date,
            },
          };

          // Mover todas las transacciones de la entidad a la nueva entidad
          for (const mv of deletedMovements) {
            await generateMovements(
              tx,
              newTxForMovement,
              mv.account,
              mv.direction,
              mv.type,
              ctx.redlock,
            );
          }
        }

        await lock.release();

        return {
          transactionCount: newEntityTxIds.length,
        };
      });
    }),
});
