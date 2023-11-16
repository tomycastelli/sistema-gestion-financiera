import { z } from "zod";
import { findDifferences } from "~/lib/functions";
import { createTRPCRouter, protectedProcedure } from "../trpc";

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
            ctx.session.user.name!,
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
          });

          if (updateTransactionResponse) {
            await ctx.redis.del(
              `operation:${updateTransactionResponse.operationId}`,
            );
          }

          console.log(`Transaction ${input.txId} edited`);
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

  updateTransactionStatus: protectedProcedure
    .input(
      z.object({
        operationId: z.number().int(),
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
            status: true,
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
          },
        });

        const movements = input.transactionIds.flatMap((transactionId) => {
          return [
            {
              transactionId,
              direction: 1,
              type: "confirmation",
            },
            {
              transactionId,
              direction: 1,
              type: "confirmation",
              status: true,
            },
          ];
        });

        const updateMovements = ctx.db.movements.createMany({
          data: movements,
        });

        const responses = await ctx.db.$transaction([
          updateTransactions,
          updateMetadata,
          updateMovements,
        ]);

        await ctx.redis.del(`operation:${input.operationId}`);

        console.log(`${responses[0].count} transactions confirmed`);
        return responses;
      } catch (error) {
        console.error(
          "An error occurred while executing the Prisma query:",
          error,
        );
        throw error;
      }
    }),
});
