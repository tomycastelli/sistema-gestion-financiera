import { TRPCError } from "@trpc/server";
import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { findDifferences, movementBalanceDirection } from "~/lib/functions";
import { generateMovements, logIO } from "~/lib/trpcFunctions";
import {
  Status,
  balances,
  entities,
  movements,
  operations,
  transactions,
  transactionsMetadata,
} from "~/server/db/schema";
import {
  createTRPCRouter,
  protectedLoggedProcedure,
  protectedProcedure,
} from "../trpc";
import { currentAccountOnlyTypes } from "~/lib/variables";
import { alias } from "drizzle-orm/pg-core";

export const editingOperationsRouter = createTRPCRouter({
  updateTransactionValues: protectedProcedure
    .input(
      z.object({
        txId: z.number().int(),
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
      const response = await ctx.db.transaction(async (transaction) => {
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
          .where(eq(transactions.id, input.txId)).returning({ id: transactions.id });

        if (!newTxObj) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Transaction to update not found"
          })
        }
        await transaction
          .update(transactionsMetadata)
          .set({
            // @ts-ignore
            history: newHistoryJson2,
          })
          .where(eq(transactionsMetadata.transactionId, input.txId));

        // Borro los movimientos relacionados a la transaccion
        const deletedMovements = await transaction.delete(movements).where(
          eq(movements.transactionId, newTxObj.id)
        ).returning();

        for (const deletedMovement of deletedMovements) {
          const changedAmount = movementBalanceDirection(input.oldTransactionData.fromEntityId, input.oldTransactionData.toEntityId, deletedMovement.direction) * input.oldTransactionData.amount

          const [relatedBalance] = await transaction.select().from(balances).where(eq(balances.id, deletedMovement.balanceId))

          const selectedEntityId = relatedBalance!.selectedEntityId!
          const otherEntityId = relatedBalance!.otherEntityId!

          const balanceQuery = deletedMovement.entitiesMovementId ?
            relatedBalance!.otherEntityId ? and(
              eq(balances.otherEntityId, otherEntityId),
              eq(balances.tagName, relatedBalance!.tagName!)
            ) : and(
              eq(balances.selectedEntityId, selectedEntityId),
              eq(balances.tagName, relatedBalance!.tagName!)
            ) : and(
              eq(balances.selectedEntityId, selectedEntityId),
              eq(balances.otherEntityId, otherEntityId),
            )

          // Retrocedo el balance relacionado a ese movimiento y los posteriores
          await transaction
            .update(balances)
            .set({ balance: sql`${balances.balance} - ${changedAmount}` })
            .where(
              or(
                eq(balances.id, deletedMovement.balanceId),
                and(
                  eq(balances.account, deletedMovement.account),
                  eq(balances.currency, input.oldTransactionData.currency),
                  balanceQuery,
                  gt(balances.date, relatedBalance!.date)
                )
              ))

          // Retrocedo el balance de todos los movimientos posteriores
          const mvsToUpdate = await transaction
            .select({ id: movements.id }).from(movements)
            .leftJoin(transactions, eq(movements.transactionId, transactions.id))
            .leftJoin(operations, eq(transactions.operationId, operations.id))
            .leftJoin(balances, eq(movements.balanceId, balances.id))
            .where(
              and(
                eq(balances.account, deletedMovement.account),
                eq(balances.currency, input.oldTransactionData.currency),
                balanceQuery,
                gt(operations.date, relatedBalance!.date),
              ))

          const mvsIds = mvsToUpdate.length > 0 ? mvsToUpdate.map(obj => obj.id) : [0]

          console.log("Movimientos posteriores que seran retrotraidos: ", mvsIds)

          await transaction.update(movements)
            .set({ balance: sql`${movements.balance} - ${changedAmount}` })
            .where(inArray(movements.id, mvsIds))
        }

        const fromEntity = alias(entities, "fromEntity");
        const toEntity = alias(entities, "toEntity");

        const [newTxResponse] = await transaction.select().from(transactions)
          .leftJoin(fromEntity, eq(transactions.fromEntityId, fromEntity.id))
          .leftJoin(toEntity, eq(transactions.toEntityId, toEntity.id))
          .leftJoin(operations, eq(transactions.operationId, operations.id))
          .where(eq(transactions.id, newTxObj.id))

        const txForMovement = { ...newTxResponse!.Transactions, fromEntity: newTxResponse!.fromEntity!, toEntity: newTxResponse!.toEntity!, operation: newTxResponse!.Operations! }

        const filteredMovements = deletedMovements.filter(mv => mv.entitiesMovementId === null)

        // Filtro para loopear los movimientos originales, no los que hacen referencia a los originales
        for (const deletedMovement of filteredMovements) {
          await generateMovements(transaction, txForMovement, deletedMovement.account, deletedMovement.direction, deletedMovement.type)
        }


        return newTxResponse!.Transactions
      });

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
      try {
        const response = await ctx.db.transaction(async (transaction) => {
          const confirmedTxs = []

          const fromEntity = alias(entities, "fromEntity");
          const toEntity = alias(entities, "toEntity");

          for (const txId of input.transactionIds) {
            const [transactionData] = await transaction.select().from(transactions)
              .leftJoin(fromEntity, eq(transactions.fromEntityId, fromEntity.id))
              .leftJoin(toEntity, eq(transactions.toEntityId, toEntity.id))
              .leftJoin(operations, eq(transactions.operationId, operations.id))
              .where(eq(transactions.id, txId))

            if (!transactionData || !transactionData.Operations) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Transaction ${txId} does not exist`
              })
            }

            if (transactionData.Transactions.status !== Status.enumValues[2] || currentAccountOnlyTypes.has(transactionData.Transactions.type)) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "This transaction cannot be confirmed"
              })
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

            const mappedTransaction = { ...transactionData.Transactions, operation: { date: transactionData.Operations.date }, fromEntity: transactionData.fromEntity!, toEntity: transactionData.toEntity! }

            await generateMovements(transaction, mappedTransaction, false, 1, "confirmation");
            await generateMovements(transaction, mappedTransaction, true, 1, "confirmation");

            confirmedTxs.push(mappedTransaction.id)
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
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
        });
      }
    }),
  cancelTransaction: protectedLoggedProcedure
    .input(
      z.object({
        transactionId: z.number().int().optional(),
        operationId: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.db.transaction(async (transaction) => {
        const transactionsToCancel = await transaction.query.transactions.findMany({
          where: and(
            input.transactionId
              ? eq(transactions.id, input.transactionId)
              : undefined,
            input.operationId
              ? eq(transactions.operationId, input.operationId)
              : undefined,

          ),
          with: {
            operation: true,
            movements: true,
            fromEntity: true,
            toEntity: true
          }
        })

        // Transaction cancellation
        await transaction.update(transactions).set({ status: Status.enumValues[0] }).where(inArray(transactions.id, transactionsToCancel.map(tx => tx.id)))

        if (input.transactionId) {
          await transaction
            .update(transactionsMetadata)
            .set({
              cancelledBy: ctx.user.id,
              cancelledDate: new Date(),
            })
            .where(eq(transactionsMetadata.transactionId, input.transactionId));
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
          for (const mv of tx.movements.filter(m => m.entitiesMovementId === null)) {
            await generateMovements(transaction, tx, mv.account, mv.direction * (-1), "cancellation")
          }
        }

        return transactionsToCancel
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
});
