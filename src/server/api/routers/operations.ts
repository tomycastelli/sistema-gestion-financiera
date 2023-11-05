import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import type { OperationsByUserResponse } from "./types";

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
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
              movements: {
                create: {
                  direction: -1,
                  type: "upload",
                },
              },
              transactionMetadata: {
                create: {
                  metadata: {
                    uploadDate: new Date(),
                    uploadedBy: ctx.session.user.id,
                  },
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
        await ctx.redis.del(`user_id:${ctx.session.user.id}`);
      }

      return {
        message: "Inserted the operation and associated rows",
        data: response,
      };
    }),

  getOperationsByUser: protectedProcedure.query(async ({ ctx }) => {
    const cachedUserOperations: string | null = await ctx.redis.get(
      `user_id:${ctx.session.user.id}`,
    );

    if (cachedUserOperations) {
      const parsedCachedUserOperations: OperationsByUserResponse[] =
        JSON.parse(cachedUserOperations);
      console.log("Operations queried from cache");
      return parsedCachedUserOperations;
    }

    const operations = await ctx.db.operations.findMany({
      where: {
        transactions: {
          some: {
            transactionMetadata: {
              metadata: {
                path: ["uploadedBy"],
                equals: ctx.session.user.id,
              },
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
        transactions: {
          select: {
            transactionMetadata: {
              select: {
                metadata: true,
              },
            },
          },
        },
      },
      orderBy: {
        id: "desc",
      },
      take: 5,
    });

    await ctx.redis.set(
      `user_id:${ctx.session.user.id}`,
      JSON.stringify(operations),
      "EX",
      "3600",
    );
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
      }),
    )
    .query(async ({ ctx, input }) => {
      const cachedOperations: typeof queriedOperations = [];

      const stream = ctx.redis.scanStream({ match: "operation_id:*" });

      const fetchCachedOperations = async (keys: string[]) => {
        for (const key of keys) {
          const operation = await ctx.redis.get(key);
          if (operation) {
            const parsedOperation = JSON.parse(
              operation,
            ) as (typeof queriedOperations)[number];
            cachedOperations.push(parsedOperation);
          }
        }
      };

      stream.on("data", (keys: string[]) => {
        void fetchCachedOperations(keys);
      });

      stream.on("end", () => {
        console.log("All cached operations have been visited");
      });

      // To exclude this operations from being queried again
      const listOfIds: number[] = cachedOperations.map((obj) => obj.id);

      let remainingLimit: number = input.limit - cachedOperations.length;
      if (remainingLimit <= 0) {
        remainingLimit = 0; // Set take to 0 when the cache meets or exceeds the limit
      }

      const queriedOperations = await ctx.db.operations.findMany({
        where: {
          id: {
            notIn: listOfIds,
          },
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
              ? { date: { gt: input.opDateIsGreater } }
              : {},
            input.opDateIsLesser ? { date: { lt: input.opDateIsLesser } } : {},
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
                input.uploadedById
                  ? {
                      transactionMetadata: {
                        metadata: {
                          path: ["uploadedBy"],
                          equals: input.uploadedById,
                        },
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
              transactionMetadata: true,
              operatorEntity: true,
              fromEntity: true,
              toEntity: true,
            },
          },
        },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        orderBy: {
          id: "desc",
        },
      });

      // hago el mix de queried y cached y ordeno de mayor id a menor id
      const operations = [...queriedOperations, ...cachedOperations].sort(
        (a, b) => b.id - a.id,
      );

      // save operations to cache, set a redis pipeline for faster caching
      const pipeline = ctx.redis.pipeline();
      queriedOperations.forEach((op) => {
        const key = `operation_id:${op.id}`;
        const exists = pipeline.exists(key);
        if (!exists) {
          pipeline.set(
            `operation_id:${op.id}`,
            JSON.stringify(op),
            "EX",
            "3600",
          );
        }
      });
      await pipeline.exec((err, results) => {
        console.log(results);
      });

      return operations;
    }),
});
