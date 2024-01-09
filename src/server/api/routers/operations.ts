import type { Transactions } from "@prisma/client";
import moment from "moment";
import { z } from "zod";
import { getAllChildrenTags } from "~/lib/functions";
import {
  generateMovements,
  getAllPermissions,
  getAllTags,
  undoBalances,
} from "~/lib/trpcFunctions";
import { cashAccountOnlyTypes, currentAccountOnlyTypes } from "~/lib/variables";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const operationsRouter = createTRPCRouter({
  insertOperation: protectedProcedure
    .input(
      z.object({
        opDate: z.date(),
        opObservations: z.string().optional(),
        opId: z.number().int().optional().nullable(),
        transactions: z.array(
          z.object({
            type: z.string(),
            date: z.date().optional(),
            operatorEntityId: z.number().int(),
            fromEntityId: z.number().int(),
            toEntityId: z.number().int(),
            currency: z.string(),
            amount: z.number().positive(),
            method: z.string().optional(),
            metadata: z
              .object({ exchangeRate: z.number().optional() })
              .optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.opId) {
        const response: Transactions[] = [];
        for (const transactionToInsert of input.transactions) {
          const tx = await ctx.db.transactions.create({
            data: {
              ...transactionToInsert,
              operationId: input.opId,
              transactionMetadata: {
                create: {
                  uploadedBy: ctx.session.user.id,
                  uploadedDate: new Date(),
                  metadata: transactionToInsert.metadata,
                },
              },
            },
            include: { operation: true },
          });
          response.push(tx);
          if (
            cashAccountOnlyTypes.includes(tx.type) ||
            tx.type === "pago por cta cte"
          ) {
            await generateMovements(ctx.db, tx, true, 1, "upload");
          }
          if (
            !cashAccountOnlyTypes.includes(tx.type) ||
            tx.type === "pago por cta cte"
          ) {
            await generateMovements(ctx.db, tx, false, -1, "upload");
          }
        }

        if (response) {
          await ctx.redis.del(`user_operations:${ctx.session.user.id}`);
        }
        return response;
      } else {
        const response = await ctx.db.operations.create({
          data: {
            date: input.opDate,
            observations: input.opObservations,
            transactions: {
              create: input.transactions.map((transaction) => ({
                type: transaction.type,
                date: transaction.date,
                operatorEntity: {
                  connect: { id: transaction.operatorEntityId },
                },
                fromEntity: { connect: { id: transaction.fromEntityId } },
                toEntity: { connect: { id: transaction.toEntityId } },
                currency: transaction.currency,
                amount: transaction.amount,
                method: transaction.method,
                status:
                  cashAccountOnlyTypes.includes(transaction.type) ||
                  transaction.type === "pago por cta cte"
                    ? "confirmed"
                    : "pending",
                transactionMetadata: {
                  create: {
                    uploadedBy: ctx.session.user.id,
                    uploadedDate: new Date(),
                    metadata: transaction.metadata,
                  },
                },
              })),
            },
          },
          include: {
            transactions: {
              include: {
                transactionMetadata: true,
                operation: { select: { date: true } },
              },
            },
          },
        });

        console.time("balancesCreation"); // Start timer

        for (const tx of response.transactions) {
          if (
            cashAccountOnlyTypes.includes(tx.type) ||
            tx.type === "pago por cta cte"
          ) {
            await generateMovements(ctx.db, tx, true, 1, "upload");
          }
          if (
            !cashAccountOnlyTypes.includes(tx.type) ||
            tx.type === "pago por cta cte"
          ) {
            await generateMovements(ctx.db, tx, false, -1, "upload");
          }
        }

        console.timeEnd("balancesCreation"); // End timer and log the time

        if (response) {
          console.time("cacheDeletion"); // End timer and log the time
          await ctx.redis.del(`user_operations:${ctx.session.user.id}`);
          console.timeEnd("cacheDeletion"); // End timer and log the time
        }

        console.time("insertionTime"); // Start timer

        const newLog = new ctx.logs({
          name: "insertOperation",
          timestamp: new Date(),
          createdBy: ctx.session.user.id,
          input: input,
          output: response,
        });

        await newLog.save();

        console.timeEnd("insertionTime"); // End timer and log the time

        return response;
      }
    }),

  insertTransactions: protectedProcedure
    .input(
      z.object({
        operationId: z.number().int(),
        transactions: z.array(
          z.object({
            type: z.string(),
            operatorEntityId: z.number().int(),
            fromEntityId: z.number().int(),
            toEntityId: z.number().int(),
            currency: z.string(),
            amount: z.number(),
            method: z.string().optional(),
            metadata: z
              .object({ exchangeRate: z.number().optional() })
              .optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const response = await ctx.db.transactions.createMany({
        data: input.transactions.map((tx) => ({
          ...tx,
          operationId: input.operationId,
        })),
      });

      if (response) {
        await ctx.redis.del(`user_operations:${ctx.session.user.id}`);
      }

      const newLog = new ctx.logs({
        name: "insertTransactions",
        timestamp: new Date(),
        createdBy: ctx.session.user.id,
        input: input,
        output: response,
      });

      await newLog.save();

      return response;
    }),

  getOperationsByUser: protectedProcedure.query(async ({ ctx }) => {
    const operations = await ctx.db.operations.findMany({
      where: {
        transactions: {
          some: {
            transactionMetadata: {
              uploadedBy: ctx.session.user.id,
            },
          },
        },
      },
      select: {
        id: true,
        date: true,
        observations: true,
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: {
        id: "desc",
      },
      take: 5,
    });

    return operations;
  }),

  getOperations: protectedProcedure
    .input(
      z.object({
        limit: z.number(),
        page: z.number(),
        operationId: z.number().optional(),
        opDay: z.date().optional(),
        opDateIsGreater: z.date().optional(),
        opDateIsLesser: z.date().optional(),
        transactionId: z.number().optional(),
        transactionType: z.string().optional(),
        transactionDate: z.date().optional(),
        operatorEntityId: z.number().optional(),
        fromEntityId: z.number().optional(),
        toEntityId: z.number().optional(),
        currency: z.string().optional(),
        method: z.string().optional(),
        status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
        uploadedById: z.string().optional(),
        confirmedById: z.string().optional(),
        amountIsLesser: z.number().optional(),
        amountIsGreater: z.number().optional(),
        amount: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const queriedOperations = await ctx.db.operations.findMany({
        where: {
          AND: [
            input.opDay
              ? {
                  date: {
                    gte: new Date(
                      input.opDay.getFullYear(),
                      input.opDay.getMonth(),
                      input.opDay.getDate(),
                    ),
                    lt: new Date(
                      input.opDay.getFullYear(),
                      input.opDay.getMonth(),
                      input.opDay.getDate() + 1,
                    ),
                  },
                }
              : {},
            input.opDateIsGreater
              ? { date: { gte: input.opDateIsGreater } }
              : {},
            input.opDateIsLesser ? { date: { lte: input.opDateIsLesser } } : {},
            input.operationId ? { id: input.operationId } : {},
          ],
          transactions: {
            some: {
              AND: [
                input.transactionId ? { id: input.transactionId } : {},
                input.transactionType ? { type: input.transactionType } : {},
                input.transactionDate ? { date: input.transactionDate } : {},
                input.operatorEntityId
                  ? { operatorEntityId: input.operatorEntityId }
                  : {},
                input.fromEntityId ? { fromEntityId: input.fromEntityId } : {},
                input.toEntityId ? { toEntityId: input.toEntityId } : {},
                input.currency ? { currency: input.currency } : {},
                input.method ? { method: input.method } : {},
                input.status ? { status: input.status } : {},
                input.amount && input.currency
                  ? {
                      amount: input.amount,
                      currency: input.currency,
                    }
                  : input.amount
                  ? { amount: input.amount }
                  : input.currency
                  ? { currency: input.currency }
                  : {},
                input.amountIsGreater && input.currency
                  ? {
                      amount: { gte: input.amountIsGreater },
                      currency: input.currency,
                    }
                  : input.amount
                  ? { amount: { gte: input.amount } }
                  : input.currency
                  ? { currency: input.currency }
                  : {},
                input.amountIsLesser && input.currency
                  ? {
                      amount: { lte: input.amountIsLesser },
                      currency: input.currency,
                    }
                  : input.amount
                  ? { amount: { lte: input.amountIsLesser } }
                  : input.currency
                  ? { currency: input.currency }
                  : {},
                input.uploadedById
                  ? {
                      transactionMetadata: {
                        uploadedBy: input.uploadedById,
                      },
                    }
                  : {},
                input.confirmedById
                  ? {
                      transactionMetadata: {
                        confirmedBy: input.confirmedById,
                      },
                    }
                  : {},
              ],
            },
          },
        },
        include: {
          transactions: {
            include: {
              transactionMetadata: {
                include: {
                  uploadedByUser: true,
                  confirmedByUser: true,
                  cancelledByUser: true,
                },
              },
              operatorEntity: {
                include: {
                  tag: true,
                },
              },
              fromEntity: {
                include: {
                  tag: true,
                },
              },
              toEntity: {
                include: {
                  tag: true,
                },
              },
            },
          },
        },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: {
          id: "desc",
        },
      });

      const userPermissions = await getAllPermissions(
        ctx.redis,
        ctx.session,
        ctx.db,
        { userId: undefined },
      );
      const tags = await getAllTags(ctx.redis, ctx.db);

      const operationsWithPermissions = queriedOperations.map((op) => {
        const isVisualizeAllowed = userPermissions?.find(
          (p) => p.name === "ADMIN" || p.name === "OPERATIONS_VISUALIZE",
        )
          ? true
          : userPermissions?.find((p) => {
              const allAllowedTags = getAllChildrenTags(p.entitiesTags, tags);
              if (
                p.name === "OPERATIONS_VISUALIZE_SOME" &&
                op.transactions.find(
                  (tx) =>
                    p.entitiesIds?.includes(tx.fromEntityId) ||
                    allAllowedTags.includes(tx.fromEntity.tagName),
                ) &&
                op.transactions.find(
                  (tx) =>
                    p.entitiesIds?.includes(tx.toEntityId) ||
                    allAllowedTags.includes(tx.toEntity.tagName),
                )
              ) {
                return true;
              }
            })
          ? true
          : false;

        const isCreateAllowed = userPermissions?.find(
          (p) => p.name === "ADMIN" || p.name === "OPERATIONS_CREATE",
        )
          ? true
          : userPermissions?.find((p) => {
              const allAllowedTags = getAllChildrenTags(p.entitiesTags, tags);
              if (
                p.name === "OPERATIONS_CREATE_SOME" &&
                op.transactions.find(
                  (tx) =>
                    p.entitiesIds?.includes(tx.fromEntityId) ||
                    allAllowedTags.includes(tx.fromEntity.tagName),
                ) &&
                op.transactions.find(
                  (tx) =>
                    p.entitiesIds?.includes(tx.toEntityId) ||
                    allAllowedTags.includes(tx.toEntity.tagName),
                )
              ) {
                return true;
              }
            })
          ? true
          : false;

        return {
          ...op,
          isVisualizeAllowed,
          isCreateAllowed,
          transactions: op.transactions.map((tx) => {
            const isCancelAllowed =
              tx.status !== "cancelled" &&
              (tx.status !== "confirmed" ||
                cashAccountOnlyTypes.includes(tx.type) ||
                tx.type === "pago por cta cte") &&
              userPermissions?.find(
                (p) => p.name === "ADMIN" || p.name === "TRANSACTIONS_CANCEL",
              )
                ? true
                : userPermissions?.find((p) => {
                    const allAllowedTags = getAllChildrenTags(
                      p.entitiesTags,
                      tags,
                    );
                    if (
                      p.name === "TRANSACTIONS_CANCEL_SOME" &&
                      (p.entitiesIds?.includes(tx.fromEntityId) ||
                        allAllowedTags.includes(tx.fromEntity.tagName)) &&
                      (p.entitiesIds?.includes(tx.toEntityId) ||
                        allAllowedTags.includes(tx.toEntity.tagName))
                    ) {
                      return true;
                    }
                  })
                ? true
                : false;

            const isDeleteAllowed =
              tx.status !== "cancelled" &&
              (tx.status !== "confirmed" ||
                cashAccountOnlyTypes.includes(tx.type) ||
                tx.type === "pago por cta cte") &&
              userPermissions?.find(
                (p) => p.name === "ADMIN" || p.name === "TRANSACTIONS_DELETE",
              )
                ? true
                : userPermissions?.find((p) => {
                    const allAllowedTags = getAllChildrenTags(
                      p.entitiesTags,
                      tags,
                    );
                    if (
                      p.name === "TRANSACTIONS_DELETE_SOME" &&
                      (p.entitiesIds?.includes(tx.fromEntityId) ||
                        allAllowedTags.includes(tx.fromEntity.tagName)) &&
                      (p.entitiesIds?.includes(tx.toEntityId) ||
                        allAllowedTags.includes(tx.toEntity.tagName))
                    ) {
                      return true;
                    }
                  })
                ? true
                : false;

            const isUpdateAllowed =
              (tx.date
                ? moment().isSame(tx.date, "day")
                : moment().isSame(op.date, "day")) &&
              userPermissions?.find(
                (p) => p.name === "ADMIN" || p.name === "TRANSACTIONS_UPDATE",
              )
                ? true
                : userPermissions?.find((p) => {
                    const allAllowedTags = getAllChildrenTags(
                      p.entitiesTags,
                      tags,
                    );
                    if (
                      p.name === "TRANSACTIONS_UPDATE_SOME" &&
                      (p.entitiesIds?.includes(tx.fromEntityId) ||
                        allAllowedTags.includes(tx.fromEntity.tagName)) &&
                      (p.entitiesIds?.includes(tx.toEntityId) ||
                        allAllowedTags.includes(tx.toEntity.tagName))
                    ) {
                      return true;
                    }
                  })
                ? true
                : false;

            const isValidateAllowed =
              currentAccountOnlyTypes.includes(tx.type) &&
              tx.status === "pending" &&
              userPermissions?.find(
                (p) => p.name === "ADMIN" || p.name === "TRANSACTIONS_VALIDATE",
              )
                ? true
                : userPermissions?.find((p) => {
                    const allAllowedTags = getAllChildrenTags(
                      p.entitiesTags,
                      tags,
                    );
                    if (
                      p.name === "TRANSACTIONS_VALIDATE_SOME" &&
                      (p.entitiesIds?.includes(tx.fromEntityId) ||
                        allAllowedTags.includes(tx.fromEntity.tagName)) &&
                      (p.entitiesIds?.includes(tx.toEntityId) ||
                        allAllowedTags.includes(tx.toEntity.tagName))
                    ) {
                      return true;
                    }
                  })
                ? true
                : false;
            return {
              ...tx,
              isDeleteAllowed,
              isCancelAllowed,
              isUpdateAllowed,
              isValidateAllowed,
            };
          }),
        };
      });

      const count = await ctx.db.operations.count({
        where: {
          AND: [
            input.opDay
              ? {
                  date: {
                    gte: new Date(
                      input.opDay.getFullYear(),
                      input.opDay.getMonth(),
                      input.opDay.getDate(),
                    ),
                    lt: new Date(
                      input.opDay.getFullYear(),
                      input.opDay.getMonth(),
                      input.opDay.getDate() + 1,
                    ),
                  },
                }
              : {},
            input.opDateIsGreater
              ? { date: { gte: input.opDateIsGreater } }
              : {},
            input.opDateIsLesser ? { date: { lte: input.opDateIsLesser } } : {},
          ],
          transactions: {
            some: {
              AND: [
                input.transactionId ? { id: input.transactionId } : {},
                input.transactionType ? { type: input.transactionType } : {},
                input.transactionDate ? { date: input.transactionDate } : {},
                input.operatorEntityId
                  ? { operatorEntityId: input.operatorEntityId }
                  : {},
                input.fromEntityId ? { fromEntityId: input.fromEntityId } : {},
                input.toEntityId ? { toEntityId: input.toEntityId } : {},
                input.currency ? { currency: input.currency } : {},
                input.method ? { method: input.method } : {},
                input.status ? { status: input.status } : {},
                input.amount && input.currency
                  ? {
                      amount: input.amount,
                      currency: input.currency,
                    }
                  : input.amount
                  ? { amount: input.amount }
                  : input.currency
                  ? { currency: input.currency }
                  : {},
                input.amountIsGreater && input.currency
                  ? {
                      amount: { gte: input.amountIsGreater },
                      currency: input.currency,
                    }
                  : input.amount
                  ? { amount: { gte: input.amount } }
                  : input.currency
                  ? { currency: input.currency }
                  : {},
                input.amountIsLesser && input.currency
                  ? {
                      amount: { lte: input.amountIsLesser },
                      currency: input.currency,
                    }
                  : input.amount
                  ? { amount: { lte: input.amountIsLesser } }
                  : input.currency
                  ? { currency: input.currency }
                  : {},
                input.uploadedById
                  ? {
                      transactionMetadata: {
                        uploadedBy: input.uploadedById,
                      },
                    }
                  : {},
                input.confirmedById
                  ? {
                      transactionMetadata: {
                        confirmedBy: input.confirmedById,
                      },
                    }
                  : {},
              ],
            },
          },
        },
      });

      return { operations: operationsWithPermissions, count };
    }),
  getOperationDetails: protectedProcedure
    .input(z.object({ operationId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const operationDetails = await ctx.db.operations.findUnique({
        where: {
          id: input.operationId,
        },
        include: {
          transactions: {
            include: {
              fromEntity: {
                include: {
                  tag: true,
                },
              },
              toEntity: {
                include: {
                  tag: true,
                },
              },
              operatorEntity: {
                include: {
                  tag: true,
                },
              },
              movements: true,
              transactionMetadata: {
                include: {
                  uploadedByUser: true,
                  confirmedByUser: true,
                  cancelledByUser: true,
                },
              },
            },
          },
        },
      });

      if (operationDetails) {
        const userPermissions = await getAllPermissions(
          ctx.redis,
          ctx.session,
          ctx.db,
          { userId: undefined },
        );
        const tags = await getAllTags(ctx.redis, ctx.db);

        const isVisualizeAllowed = userPermissions?.find(
          (p) => p.name === "ADMIN" || p.name === "OPERATIONS_VISUALIZE",
        )
          ? true
          : userPermissions?.find((p) => {
              const allAllowedTags = getAllChildrenTags(p.entitiesTags, tags);
              if (
                p.name === "OPERATIONS_VISUALIZE_SOME" &&
                operationDetails?.transactions.find(
                  (tx) =>
                    p.entitiesIds?.includes(tx.fromEntityId) ||
                    allAllowedTags.includes(tx.fromEntity.tagName),
                ) &&
                operationDetails?.transactions.find(
                  (tx) =>
                    p.entitiesIds?.includes(tx.toEntityId) ||
                    allAllowedTags.includes(tx.toEntity.tagName),
                )
              ) {
                return true;
              }
            })
          ? true
          : false;

        const isCreateAllowed = userPermissions?.find(
          (p) => p.name === "ADMIN" || p.name === "OPERATIONS_CREATE",
        )
          ? true
          : userPermissions?.find((p) => {
              const allAllowedTags = getAllChildrenTags(p.entitiesTags, tags);
              if (
                p.name === "OPERATIONS_CREATE_SOME" &&
                operationDetails?.transactions.find(
                  (tx) =>
                    p.entitiesIds?.includes(tx.fromEntityId) ||
                    allAllowedTags.includes(tx.fromEntity.tagName),
                ) &&
                operationDetails?.transactions.find(
                  (tx) =>
                    p.entitiesIds?.includes(tx.toEntityId) ||
                    allAllowedTags.includes(tx.toEntity.tagName),
                )
              ) {
                return true;
              }
            })
          ? true
          : false;

        const operationDetailsWithPermissions = {
          ...operationDetails,
          isVisualizeAllowed,
          isCreateAllowed,
          transactions: operationDetails?.transactions.map((tx) => {
            const isCancelAllowed =
              tx.status !== "cancelled" &&
              (tx.status !== "confirmed" ||
                cashAccountOnlyTypes.includes(tx.type) ||
                tx.type === "pago por cta cte") &&
              userPermissions?.find(
                (p) => p.name === "ADMIN" || p.name === "TRANSACTIONS_CANCEL",
              )
                ? true
                : userPermissions?.find((p) => {
                    const allAllowedTags = getAllChildrenTags(
                      p.entitiesTags,
                      tags,
                    );
                    if (
                      p.name === "TRANSACTIONS_CANCEL_SOME" &&
                      (p.entitiesIds?.includes(tx.fromEntityId) ||
                        allAllowedTags.includes(tx.fromEntity.tagName)) &&
                      (p.entitiesIds?.includes(tx.toEntityId) ||
                        allAllowedTags.includes(tx.toEntity.tagName))
                    ) {
                      return true;
                    }
                  })
                ? true
                : false;

            const isDeleteAllowed =
              tx.status !== "cancelled" &&
              (tx.status !== "confirmed" ||
                cashAccountOnlyTypes.includes(tx.type) ||
                tx.type === "pago por cta cte") &&
              userPermissions?.find(
                (p) => p.name === "ADMIN" || p.name === "TRANSACTIONS_DELETE",
              )
                ? true
                : userPermissions?.find((p) => {
                    const allAllowedTags = getAllChildrenTags(
                      p.entitiesTags,
                      tags,
                    );
                    if (
                      p.name === "TRANSACTIONS_DELETE_SOME" &&
                      (p.entitiesIds?.includes(tx.fromEntityId) ||
                        allAllowedTags.includes(tx.fromEntity.tagName)) &&
                      (p.entitiesIds?.includes(tx.toEntityId) ||
                        allAllowedTags.includes(tx.toEntity.tagName))
                    ) {
                      return true;
                    }
                  })
                ? true
                : false;

            const isUpdateAllowed = userPermissions?.find(
              (p) => p.name === "ADMIN" || p.name === "TRANSACTIONS_UPDATE",
            )
              ? true
              : userPermissions?.find((p) => {
                  const allAllowedTags = getAllChildrenTags(
                    p.entitiesTags,
                    tags,
                  );
                  if (
                    p.name === "TRANSACTIONS_UPDATE_SOME" &&
                    (p.entitiesIds?.includes(tx.fromEntityId) ||
                      allAllowedTags.includes(tx.fromEntity.tagName)) &&
                    (p.entitiesIds?.includes(tx.toEntityId) ||
                      allAllowedTags.includes(tx.toEntity.tagName))
                  ) {
                    return true;
                  }
                })
              ? true
              : false;

            const isValidateAllowed =
              tx.status === "pending" &&
              userPermissions?.find(
                (p) => p.name === "ADMIN" || p.name === "TRANSACTIONS_VALIDATE",
              )
                ? true
                : userPermissions?.find((p) => {
                    const allAllowedTags = getAllChildrenTags(
                      p.entitiesTags,
                      tags,
                    );
                    if (
                      p.name === "TRANSACTIONS_VALIDATE_SOME" &&
                      (p.entitiesIds?.includes(tx.fromEntityId) ||
                        allAllowedTags.includes(tx.fromEntity.tagName)) &&
                      (p.entitiesIds?.includes(tx.toEntityId) ||
                        allAllowedTags.includes(tx.toEntity.tagName))
                    ) {
                      return true;
                    }
                  })
                ? true
                : false;
            return {
              ...tx,
              isDeleteAllowed,
              isUpdateAllowed,
              isValidateAllowed,
              isCancelAllowed,
            };
          }),
        };
        return operationDetailsWithPermissions;
      } else {
        return null;
      }
    }),
  deleteOperation: protectedProcedure
    .input(z.object({ operationId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const deletedBalances = await undoBalances(
        ctx.db,
        undefined,
        input.operationId,
      );

      const deletedOperation = await ctx.db.operations.delete({
        where: {
          id: input.operationId,
        },
        select: {
          transactions: {
            include: {
              movements: true,
            },
          },
        },
      });

      const newLog = new ctx.logs({
        name: "deleteOperation",
        timestamp: new Date(),
        createdBy: ctx.session.user.id,
        input: input,
        output: { deletedOperation, deletedBalances },
      });

      await newLog.save();

      return { deletedOperation, deletedBalances };
    }),

  deleteTransaction: protectedProcedure
    .input(z.object({ transactionId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const deletedBalances = await undoBalances(
        ctx.db,
        input.transactionId,
        undefined,
      );

      const deletedTransaction = await ctx.db.transactions.delete({
        where: {
          id: input.transactionId,
        },
        select: {
          movements: true,
          fromEntityId: true,
          toEntityId: true,
          amount: true,
        },
      });

      const newLog = new ctx.logs({
        name: "deleteTransaction",
        timestamp: new Date(),
        createdBy: ctx.session.user.id,
        input: input,
        output: deletedTransaction,
      });

      await newLog.save();

      return { deletedTransaction, deletedBalances };
    }),

  insights: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const monthCountSchema = z.array(
        z.object({
          day: z.date(),
          operationsCount: z.bigint(),
          transactionsCount: z.bigint(),
        }),
      );

      const monthCount = await ctx.db.$queryRaw`SELECT
      DATE_TRUNC('day', "o"."date" AT TIME ZONE 'UTC') as "day",
      COUNT(DISTINCT "o"."id") as "operationsCount",
      COUNT(DISTINCT "t"."id") as "transactionsCount"
    FROM
      "Operations" "o"
      LEFT JOIN "Transactions" "t" ON "o"."id" = "t"."operationId"
    WHERE
      "o"."date" >= NOW() - INTERVAL '7 days'
    GROUP BY
      DATE_TRUNC('day', "o"."date" AT TIME ZONE 'UTC')
    ORDER BY
      "day" ASC;`;
      console.log(monthCount);

      const parsedMonthCount = monthCountSchema.parse(monthCount);

      const userUploadsCount = await ctx.db.transactionsMetadata.count({
        where: {
          uploadedBy: input.userId,
        },
      });
      console.log(userUploadsCount);
      const userConfirmationsCount = await ctx.db.transactionsMetadata.count({
        where: {
          confirmedBy: input.userId,
        },
      });
      console.log(userConfirmationsCount);

      return {
        monthCount: parsedMonthCount,
        uploads: userUploadsCount,
        confirmations: userConfirmationsCount,
      };
    }),
  findOperationId: protectedProcedure
    .input(
      z.object({
        txId: z.number().int().optional().nullable(),
        mvId: z.number().int().optional().nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const response = await ctx.db.operations.findFirst({
        where: input.txId
          ? { transactions: { some: { id: input.txId } } }
          : input.mvId
          ? {
              transactions: {
                some: { movements: { some: { id: input.mvId } } },
              },
            }
          : { id: 0 },
      });

      return response;
    }),
});
