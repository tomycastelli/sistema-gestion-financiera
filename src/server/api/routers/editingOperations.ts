import { z } from "zod";
import { findDifferences, movementBalanceDirection } from "~/lib/functions";
import { generateMovements } from "~/lib/trpcFunctions";
import { cashAccountOnlyTypes } from "~/lib/variables";
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
        const response = await ctx.db.$transaction(async (prisma) => {
          const historyResponse = await prisma.transactionsMetadata.findUnique({
            where: {
              transactionId: input.txId,
            },
            select: {
              history: true,
            },
          });

          const oldHistoryJson = historyResponse?.history;

          const changesMade = findDifferences(
            input.oldTransactionData,
            input.newTransactionData,
            ctx.session.user.id,
          );
          // @ts-ignore
          let newHistoryJson = [];

          if (
            oldHistoryJson &&
            typeof oldHistoryJson === "object" &&
            Array.isArray(oldHistoryJson)
          ) {
            newHistoryJson = [...oldHistoryJson, changesMade];
          } else if (oldHistoryJson !== undefined) {
            newHistoryJson = [changesMade];
          }

          const updateTransactionResponse = await prisma.transactions.update({
            where: {
              id: input.txId,
            },
            data: {
              fromEntityId: input.newTransactionData.fromEntityId,
              toEntityId: input.newTransactionData.toEntityId,
              operatorEntityId: input.newTransactionData.operatorEntityId,
              currency: input.newTransactionData.currency,
              amount: input.newTransactionData.amount,
              method: input.newTransactionData.method,
              transactionMetadata: {
                update: {
                  // @ts-ignore
                  history: newHistoryJson,
                },
              },
            },
            include: {
              movements: true,
              operation: { select: { date: true } },
            },
          });

          // Borro todos los movimientos y retrocedo en los balances
          await ctx.db.movements.deleteMany({
            where: {
              id: {
                in: updateTransactionResponse.movements.flatMap((mv) => mv.id),
              },
            },
          });

          for (const mv of updateTransactionResponse.movements) {
            const amountModifiedByMovement =
              movementBalanceDirection(
                input.oldTransactionData.fromEntityId,
                input.oldTransactionData.toEntityId,
                mv.direction,
              ) * input.oldTransactionData.amount;

            await ctx.db.balances.update({
              where: {
                id: mv.balanceId,
              },
              data: {
                balance: {
                  decrement: amountModifiedByMovement,
                },
              },
            });

            // Creo los movimientos y balances con los nuevos datos
            await generateMovements(
              ctx.db,
              updateTransactionResponse,
              mv.account,
              mv.direction,
              mv.type,
            );
          }

          return updateTransactionResponse;
        });

        return response;
      } catch (error) {
        // Handle the error here
        console.error(
          "An error occurred while executing the Prisma query:",
          error,
        );
        throw error; // Rethrow the error to be caught by the caller
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
        const updateTransactions = ctx.db.transactions.updateMany({
          where: {
            id: {
              in: input.transactionIds,
            },
          },
          data: {
            status: "confirmed",
          },
        });

        const updateMetadata = ctx.db.transactionsMetadata.updateMany({
          where: {
            transactionId: {
              in: input.transactionIds,
            },
          },
          data: {
            confirmedBy: ctx.session.user.id,
            confirmedDate: new Date(),
          },
        });

        const transactionsData = ctx.db.transactions.findMany({
          where: {
            id: {
              in: input.transactionIds,
            },
          },
          include: {
            operation: { select: { date: true } },
          },
        });

        const responses = await ctx.db.$transaction([
          updateTransactions,
          updateMetadata,
          transactionsData,
        ]);

        for (const tx of responses[2]) {
          await generateMovements(ctx.db, tx, false, 1, "confirmation");
          await generateMovements(ctx.db, tx, true, 1, "confirmation");
        }

        return responses;
      } catch (error) {
        console.error(
          "An error occurred while executing the Prisma query:",
          error,
        );
        throw error;
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
      await ctx.db.transactions.updateMany({
        where: input.transactionId
          ? { id: input.transactionId }
          : { operationId: input.operationId },
        data: {
          status: "cancelled",
        },
      });

      const cancelledTransactions = await ctx.db.transactions.findMany({
        where: input.transactionId
          ? { id: input.transactionId }
          : { operationId: input.operationId },
        include: {
          transactionMetadata: true,
        },
      });

      await ctx.db.transactionsMetadata.updateMany({
        where: input.transactionId
          ? {
              transactionId: input.transactionId,
            }
          : { transaction: { operationId: input.operationId } },
        data: {
          cancelledBy: ctx.session.user.id,
          cancelledDate: new Date(),
        },
      });

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
        transactionMetadata: {
          create: {
            uploadedBy: ctx.session.user.id,
            uploadedDate: new Date(),
            cancelledBy: ctx.session.user.id,
            cancelledDate: new Date(),
            metadata: tx.transactionMetadata?.metadata
              ? tx.transactionMetadata.metadata
              : undefined,
          },
        },
      }));

      // Para cancelar, vamos a crear transacciones nuevas que cancelen con invertir from and to, con movimientos iguales
      for (const txToInsert of invertedTransactions) {
        const tx = await ctx.db.transactions.create({
          data: txToInsert,
          include: { operation: { select: { date: true } } },
        });
        if (
          cashAccountOnlyTypes.includes(tx.type) ||
          tx.type === "pago por cta cte"
        ) {
          await generateMovements(ctx.db, tx, true, 1, "cancellation");
        }
        if (
          !cashAccountOnlyTypes.includes(tx.type) ||
          tx.type === "pago por cta cte"
        ) {
          await generateMovements(ctx.db, tx, false, -1, "cancellation");
        }
        if (tx.status === "confirmed") {
          await generateMovements(ctx.db, tx, false, 1, "cancellation");
          await generateMovements(ctx.db, tx, true, 1, "cancellation");
        }
      }

      return invertedTransactions;
    }),
});
