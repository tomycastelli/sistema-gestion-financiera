import { TRPCError } from "@trpc/server";
import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { findDifferences, movementBalanceDirection } from "~/lib/functions";
import { generateMovements, logIO } from "~/lib/trpcFunctions";
import {
  Status,
  balances,
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
import moment from "moment";
import { currentAccountOnlyTypes } from "~/lib/variables";

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
          method: z.string().optional(),
        }),
        oldTransactionData: z.object({
          fromEntityId: z.number(),
          toEntityId: z.number(),
          operatorEntityId: z.number(),
          currency: z.string(),
          amount: z.number(),
          method: z.string().optional(),
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

        const [newTransaction] = await transaction
          .update(transactions)
          .set({
            fromEntityId: input.newTransactionData.fromEntityId,
            toEntityId: input.newTransactionData.toEntityId,
            operatorEntityId: input.newTransactionData.operatorEntityId,
            currency: input.newTransactionData.currency,
            amount: input.newTransactionData.amount,
            method: input.newTransactionData.method,
          })
          .where(eq(transactions.id, input.txId)).returning();

        if (!newTransaction) {
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
          eq(movements.transactionId, newTransaction.id)
        ).returning();

        const [operation] = await transaction.select({ date: operations.date }).from(operations).where(eq(operations.id, newTransaction.operationId))
        if (!operation) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Couldn't found the operation related to the transaction"
          })
        }

        const txForMovement = { ...newTransaction, operation: { date: operation.date } }

        for (const deletedMovement of deletedMovements) {
          const changedAmount = movementBalanceDirection(input.oldTransactionData.fromEntityId, input.oldTransactionData.toEntityId, deletedMovement.direction) * input.oldTransactionData.amount

          const selectedEntityId = input.oldTransactionData.fromEntityId < input.oldTransactionData.toEntityId ?
            input.oldTransactionData.fromEntityId : input.oldTransactionData.toEntityId
          const otherEntityId = input.oldTransactionData.fromEntityId === selectedEntityId ?
            input.oldTransactionData.toEntityId : input.oldTransactionData.fromEntityId

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
                  eq(balances.selectedEntityId, selectedEntityId),
                  eq(balances.otherEntityId, otherEntityId),
                  gt(balances.date, moment(operation.date).startOf("day").toDate())
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
                eq(balances.selectedEntityId, selectedEntityId),
                eq(balances.otherEntityId, otherEntityId),
                gt(operations.date, operation.date),
              ))

          const mvsIds = mvsToUpdate.length > 0 ? mvsToUpdate.map(obj => obj.id) : [0]

          await transaction.update(movements)
            .set({ balance: sql`${movements.balance} - ${changedAmount}` })
            .where(inArray(movements.id, mvsIds))

          // Creo el mismo movimiento pero con la nueva transaccion
          await generateMovements(transaction, txForMovement, deletedMovement.account, deletedMovement.direction, deletedMovement.type)
        }

        return newTransaction
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
          for (const txId of input.transactionIds) {
            const [transactionData] = await transaction.select().from(transactions)
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
                message: `Transaction ${txId} cannot be confirmed`
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

            const mappedTransaction = { ...transactionData.Transactions, operation: { date: transactionData.Operations.date } }

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
            movements: true
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
          for (const mv of tx.movements) {
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
