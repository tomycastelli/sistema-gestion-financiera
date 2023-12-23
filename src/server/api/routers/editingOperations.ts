import moment from "moment";
import { z } from "zod";
import { findDifferences, movementBalanceDirection } from "~/lib/functions";
import { generateMovements } from "~/lib/trpcFunctions";
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
  cancelTransaction: protectedProcedure
    .input(
      z.object({
        transactionId: z.number().int().optional(),
        operationId: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.transactionId) {
        const cancelledTransaction = await ctx.db.transactions.update({
          where: {
            id: input.transactionId,
          },
          data: {
            status: "cancelled",
          },
          select: {
            movements: true,
            fromEntityId: true,
            toEntityId: true,
            amount: true,
            id: true,
            date: true,
            currency: true,
            operation: true,
          },
        });

        await ctx.db.transactionsMetadata.update({
          where: {
            transactionId: input.transactionId,
          },
          data: {
            cancelledBy: ctx.session.user.id,
            cancelledDate: new Date(),
          },
        });

        let modifiedBalancesCounter = 0;
        let createdMovementsCounter = 0;
        if (cancelledTransaction) {
          for (const mv of cancelledTransaction.movements) {
            const amountModifiedByMovement =
              movementBalanceDirection(
                cancelledTransaction.fromEntityId,
                cancelledTransaction.toEntityId,
                mv.direction,
              ) * cancelledTransaction.amount;

            await ctx.db.movements.create({
              data: {
                transactionId: mv.transactionId,
                direction: mv.direction * -1,
                type: "cancellation",
                account: mv.account,
                balance: mv.balance - amountModifiedByMovement,
                balanceId: mv.balanceId,
              },
            });

            createdMovementsCounter += 1;

            if (
              cancelledTransaction.date
                ? moment().isSame(cancelledTransaction.date, "day")
                : moment().isSame(cancelledTransaction.operation.date, "day")
            ) {
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

              modifiedBalancesCounter += 1;
            } else {
              // En teoria esto funciona tambien para cancelar el pasado ya que mueve todo lo del futuro
              const balances = await ctx.db.balances.updateMany({
                where: {
                  OR: [
                    {
                      currency: cancelledTransaction.currency,
                      selectedEntityId:
                        cancelledTransaction.fromEntityId <
                        cancelledTransaction.toEntityId
                          ? cancelledTransaction.fromEntityId
                          : cancelledTransaction.toEntityId,
                      otherEntityId:
                        cancelledTransaction.fromEntityId <
                        cancelledTransaction.toEntityId
                          ? cancelledTransaction.toEntityId
                          : cancelledTransaction.fromEntityId,
                      account: mv.account,
                      date: {
                        gt: cancelledTransaction.date
                          ? cancelledTransaction.date
                          : cancelledTransaction.operation.date,
                      },
                    },
                    { id: mv.balanceId },
                  ],
                },
                data: {
                  balance: {
                    decrement: amountModifiedByMovement,
                  },
                },
              });
              modifiedBalancesCounter += balances.count;
            }
          }
        }
        return { modifiedBalancesCounter, createdMovementsCounter };
      } else if (input.operationId) {
        const transactionsToCancel = await ctx.db.transactions.findMany({
          where: {
            operationId: input.operationId,
          },
          select: {
            movements: true,
            fromEntityId: true,
            toEntityId: true,
            amount: true,
            id: true,
            date: true,
            currency: true,
            operation: true,
          },
        });

        await ctx.db.transactions.updateMany({
          where: {
            operationId: input.operationId,
          },
          data: {
            status: "cancelled",
          },
        });

        await ctx.db.transactionsMetadata.updateMany({
          where: {
            transactionId: { in: transactionsToCancel.flatMap((tx) => tx.id) },
          },
          data: {
            cancelledBy: ctx.session.user.id,
            cancelledDate: new Date(),
          },
        });

        let modifiedBalancesCounter = 0;
        let createdMovementsCounter = 0;
        if (transactionsToCancel) {
          for (const cancelledTransaction of transactionsToCancel) {
            for (const mv of cancelledTransaction.movements) {
              const amountModifiedByMovement =
                movementBalanceDirection(
                  cancelledTransaction.fromEntityId,
                  cancelledTransaction.toEntityId,
                  mv.direction,
                ) * cancelledTransaction.amount;

              await ctx.db.movements.create({
                data: {
                  transactionId: mv.transactionId,
                  direction: mv.direction * -1,
                  type: "cancellation",
                  account: mv.account,
                  balance: mv.balance - amountModifiedByMovement,
                  balanceId: mv.balanceId,
                },
              });

              createdMovementsCounter += 1;

              if (
                cancelledTransaction.date
                  ? moment().isSame(cancelledTransaction.date, "day")
                  : moment().isSame(cancelledTransaction.operation.date, "day")
              ) {
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

                modifiedBalancesCounter += 1;
              } else {
                // En teoria esto funciona tambien para cancelar el pasado ya que mueve todo lo del futuro
                const balances = await ctx.db.balances.updateMany({
                  where: {
                    OR: [
                      {
                        currency: cancelledTransaction.currency,
                        selectedEntityId:
                          cancelledTransaction.fromEntityId <
                          cancelledTransaction.toEntityId
                            ? cancelledTransaction.fromEntityId
                            : cancelledTransaction.toEntityId,
                        otherEntityId:
                          cancelledTransaction.fromEntityId <
                          cancelledTransaction.toEntityId
                            ? cancelledTransaction.toEntityId
                            : cancelledTransaction.fromEntityId,
                        account: mv.account,
                        date: {
                          gt: cancelledTransaction.date
                            ? cancelledTransaction.date
                            : cancelledTransaction.operation.date,
                        },
                      },
                      { id: mv.balanceId },
                    ],
                  },
                  data: {
                    balance: {
                      decrement: amountModifiedByMovement,
                    },
                  },
                });
                modifiedBalancesCounter += balances.count;
              }
            }
          }
        }
        return { modifiedBalancesCounter, createdMovementsCounter };
      }
    }),
});
