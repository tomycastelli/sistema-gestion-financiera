import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { findDifferences, movementBalanceDirection } from "~/lib/functions";
import { generateMovements, logIO } from "~/lib/trpcFunctions";
import { cashAccountOnlyTypes } from "~/lib/variables";
import {
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
      try {
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

          await transaction
            .update(transactions)
            .set({
              fromEntityId: input.newTransactionData.fromEntityId,
              toEntityId: input.newTransactionData.toEntityId,
              operatorEntityId: input.newTransactionData.operatorEntityId,
              currency: input.newTransactionData.currency,
              amount: input.newTransactionData.amount,
              method: input.newTransactionData.method,
            })
            .where(eq(transactions.id, input.txId));
          await transaction
            .update(transactionsMetadata)
            .set({
              // @ts-ignore
              history: newHistoryJson2,
            })
            .where(eq(transactionsMetadata.transactionId, input.txId));

          const updatedTransactionResponse2 =
            await transaction.query.transactions.findFirst({
              where: eq(transactions.id, input.txId),
              with: {
                movements: true,
                operation: {
                  columns: {
                    date: true,
                  },
                },
              },
            });

          if (updatedTransactionResponse2) {
            await ctx.db.delete(movements).where(
              inArray(
                movements.id,
                updatedTransactionResponse2.movements.map((mv) => mv.id),
              ),
            );

            for (const mv of updatedTransactionResponse2.movements) {
              const amountModifiedByMovement =
                movementBalanceDirection(
                  input.oldTransactionData.fromEntityId,
                  input.oldTransactionData.toEntityId,
                  mv.direction,
                ) * input.oldTransactionData.amount;

              await ctx.db
                .update(balances)
                .set({
                  balance: sql`${balances.balance} - ${amountModifiedByMovement}`,
                })
                .where(eq(balances.id, mv.balanceId));

              await generateMovements(
                transaction,
                updatedTransactionResponse2,
                mv.account,
                mv.direction,
                mv.type,
              );

              return updatedTransactionResponse2;
            }
          }
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
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
        });
      }
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
          await transaction
            .update(transactions)
            .set({
              status: "confirmed",
            })
            .where(inArray(transactions.id, input.transactionIds));

          await transaction
            .update(transactionsMetadata)
            .set({
              confirmedBy: ctx.user.id,
              confirmedDate: new Date(),
            })
            .where(
              inArray(transactionsMetadata.transactionId, input.transactionIds),
            );

          const transactionsData =
            await transaction.query.transactions.findMany({
              where: inArray(transactions.id, input.transactionIds),
              with: {
                operation: {
                  columns: {
                    date: true,
                  },
                },
              },
            });

          for (const tx of transactionsData) {
            await generateMovements(transaction, tx, false, 1, "confirmation");
            await generateMovements(transaction, tx, true, 1, "confirmation");
          }
          return transactionsData;
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
        const cancelledTransactions = await transaction
          .update(transactions)
          .set({ status: "cancelled" })
          .where(
            and(
              input.transactionId
                ? eq(transactions.id, input.transactionId)
                : undefined,
              input.operationId
                ? eq(transactions.operationId, input.operationId)
                : undefined,
            ),
          )
          .returning();

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

        const invertedTransactions = cancelledTransactions.map((tx) => ({
          operationId: tx.operationId,
          operatorEntityId: tx.operatorEntityId,
          fromEntityId: tx.toEntityId,
          toEntityId: tx.fromEntityId,
          currency: tx.currency,
          amount: tx.amount,
          method: tx.method,
          type: tx.type,
          date: new Date(),
          observations: tx.observations,
          status: tx.status,
        }));

        // Para cancelar, vamos a crear transacciones nuevas que cancelen con invertir from and to, con movimientos iguales
        const insertedTxs = await transaction
          .insert(transactions)
          .values(invertedTransactions)
          .returning();

        const operationsRelated = await transaction
          .select({ id: operations.id, date: operations.date })
          .from(operations)
          .where(
            inArray(
              operations.id,
              invertedTransactions.map((obj) => obj.operationId),
            ),
          );
        const txsForMovements = insertedTxs.map((insertedTx) => ({
          ...insertedTx,
          operation: {
            date: operationsRelated.find(
              (op) => op.id === insertedTx.operationId,
            )!.date,
          },
        }));
        for (const tx of txsForMovements) {
          if (
            cashAccountOnlyTypes.has(tx.type) ||
            tx.type === "pago por cta cte"
          ) {
            await generateMovements(transaction, tx, true, 1, "cancellation");
          }
          if (
            !cashAccountOnlyTypes.has(tx.type) ||
            tx.type === "pago por cta cte"
          ) {
            await generateMovements(transaction, tx, false, -1, "cancellation");
          }
          if (tx.status === "confirmed") {
            await generateMovements(transaction, tx, false, 1, "cancellation");
            await generateMovements(transaction, tx, true, 1, "cancellation");
          }
        }

        return cancelledTransactions;
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
