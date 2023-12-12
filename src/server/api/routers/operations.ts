import { z } from "zod";
import { getAllChildrenTags } from "~/lib/functions";
import { getAllPermissions, getAllTags } from "~/lib/trpcFunctions";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const operationsRouter = createTRPCRouter({
  insertOperation: protectedProcedure
    .input(
      z.object({
        opDate: z.date(),
        opObservations: z.string().optional(),
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
      const directCashAccountTypes = ["caja", "gasto"];

      const response = await ctx.db.operations.create({
        data: {
          date: input.opDate,
          observations: input.opObservations,
          transactions: {
            create: input.transactions.map((transaction) => ({
              type: transaction.type,
              operatorEntity: {
                connect: { id: transaction.operatorEntityId },
              },
              fromEntity: { connect: { id: transaction.fromEntityId } },
              toEntity: { connect: { id: transaction.toEntityId } },
              currency: transaction.currency,
              amount: transaction.amount,
              method: transaction.method,
              status: directCashAccountTypes.includes(transaction.type)
                ? true
                : false,
              movements: {
                create: {
                  direction: !directCashAccountTypes.includes(transaction.type)
                    ? -1
                    : 1,
                  type: "upload",
                },
              },
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
              movements: true,
              transactionMetadata: true,
            },
          },
        },
      });

      if (response) {
        await ctx.redis.del(`user_operations:${ctx.session.user.id}`);
      }

      return {
        message: "Inserted the operation and associated rows",
        data: response,
      };
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
        status: true,
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
        operationId: z.string().optional(),
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
        status: z.boolean().optional(),
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

        return {
          ...op,
          isVisualizeAllowed,
          transactions: op.transactions.map((tx) => {
            const isDeleteAllowed = userPermissions?.find(
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

            const isValidateAllowed = userPermissions?.find(
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
            };
          }),
        };
      });

      return operationsWithPermissions;
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

        const operationDetailsWithPermissions = {
          ...operationDetails,
          isVisualizeAllowed,
          transactions: operationDetails?.transactions.map((tx) => {
            const isDeleteAllowed = userPermissions?.find(
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

            const isValidateAllowed = userPermissions?.find(
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
      const deletedOperation = await ctx.db.operations.delete({
        where: {
          id: input.operationId,
        },
      });

      return deletedOperation;
    }),

  deleteTransaction: protectedProcedure
    .input(z.object({ transactionId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const deletedTransaction = await ctx.db.transactions.delete({
        where: {
          id: input.transactionId,
        },
      });

      return deletedTransaction;
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
});
