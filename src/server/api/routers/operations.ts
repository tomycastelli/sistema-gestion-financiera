import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import moment from "moment";
import type postgres from "postgres";
import { z } from "zod";
import { getAllChildrenTags } from "~/lib/functions";
import {
  generateMovements,
  getAllPermissions,
  getAllTags,
  logIO,
  undoBalances,
} from "~/lib/trpcFunctions";
import { cashAccountOnlyTypes, currentAccountOnlyTypes } from "~/lib/variables";
import {
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

export const operationsRouter = createTRPCRouter({
  insertOperation: protectedLoggedProcedure
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
        const opId = input.opId;

        const response = await ctx.db.transaction(async (tx) => {
          const list = [];
          const operation = await tx.query.operations.findFirst({
            where: eq(operations.id, opId),
          });

          if (!operation) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "The provided operation ID is not in the database",
            });
          }

          for (const transactionToInsert of input.transactions) {
            const insertedTxReturn = await tx
              .insert(transactions)
              .values({
                ...transactionToInsert,
                operationId: opId,
                status:
                  cashAccountOnlyTypes.includes(transactionToInsert.type) ||
                  transactionToInsert.type === "pago por cta cte"
                    ? "confirmed"
                    : "pending",
              })
              .returning();
            const insertedTx = insertedTxReturn[0]!;
            await tx.insert(transactionsMetadata).values({
              transactionId: insertedTx.id,
              uploadedBy: ctx.user.id,
              uploadedDate: new Date(),
              metadata: transactionToInsert.metadata,
            });

            list.push(insertedTx);

            if (
              cashAccountOnlyTypes.includes(insertedTx.type) ||
              insertedTx.type === "pago por cta cte"
            ) {
              await generateMovements(
                tx,
                { ...insertedTx, operation: operation },
                true,
                1,
                "upload",
              );
            }
            if (
              !cashAccountOnlyTypes.includes(insertedTx.type) ||
              insertedTx.type === "pago por cta cte"
            ) {
              await generateMovements(
                tx,
                { ...insertedTx, operation: operation },
                false,
                -1,
                "upload",
              );
            }
          }
          return list;
        });

        await ctx.redis.del(`user_operations:${ctx.user.id}`);
        return response;
      } else {
        const response = await ctx.db.transaction(async (tx) => {
          const list = [];
          const op = await tx
            .insert(operations)
            .values({ date: input.opDate, observations: input.opObservations })
            .returning();

          for (const txToInsert of input.transactions) {
            const insertedTxResponse = await tx
              .insert(transactions)
              .values({
                operationId: op[0]!.id,
                type: txToInsert.type,
                date: txToInsert.date,
                operatorEntityId: txToInsert.operatorEntityId,
                fromEntityId: txToInsert.fromEntityId,
                toEntityId: txToInsert.toEntityId,
                currency: txToInsert.currency,
                amount: txToInsert.amount,
                method: txToInsert.method,
                status:
                  cashAccountOnlyTypes.includes(txToInsert.type) ||
                  txToInsert.type === "pago por cta cte"
                    ? "confirmed"
                    : "pending",
              })
              .returning();

            const insertedTx = insertedTxResponse[0]!;

            list.push({ ...insertedTx, operation: op[0]! });

            await tx.insert(transactionsMetadata).values({
              transactionId: insertedTx.id,
              uploadedBy: ctx.user.id,
              uploadedDate: new Date(),
              metadata: txToInsert.metadata,
            });

            if (
              cashAccountOnlyTypes.includes(insertedTx.type) ||
              insertedTx.type === "pago por cta cte"
            ) {
              await generateMovements(
                tx,
                { ...insertedTx, operation: op[0]! },
                true,
                1,
                "upload",
              );
            }
            if (
              !cashAccountOnlyTypes.includes(insertedTx.type) ||
              insertedTx.type === "pago por cta cte"
            ) {
              await generateMovements(
                tx,
                { ...insertedTx, operation: op[0]! },
                false,
                -1,
                "upload",
              );
            }
          }

          return list;
        });

        await ctx.redis.del(`user_operations:${ctx.user.id}`);

        await logIO(
          ctx.dynamodb,
          ctx.user.id,
          "Insertar operación",
          input,
          response,
        );

        return response;
      }
    }),
  getOperationsByUser: protectedProcedure.query(async ({ ctx }) => {
    const response = await ctx.db
      .select({
        id: operations.id,
        date: operations.date,
        observations: operations.observations,
        transactionsCount: count(transactions.id),
      })
      .from(operations)
      .leftJoin(transactions, eq(operations.id, transactions.operationId))
      .groupBy(operations.id)
      .orderBy(desc(operations.id))
      .limit(5);

    return response;
  }),
  getOperations: protectedLoggedProcedure
    .input(
      z.object({
        limit: z.number(),
        page: z.number(),
        operationId: z.number().optional(),
        opDateIsGreater: z.date().optional(),
        opDateIsLesser: z.date().optional(),
        transactionId: z.number().optional(),
        transactionType: z.string().optional(),
        transactionDate: z.date().optional(),
        operatorEntityId: z.array(z.number()).optional(),
        fromEntityId: z.array(z.number()).optional(),
        toEntityId: z.array(z.number()).optional(),
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
      const operationsWhere = and(
        input.operationId ? eq(operations.id, input.operationId) : undefined,
        input.opDateIsGreater && !input.opDateIsLesser
          ? and(
              gte(
                operations.date,
                moment(input.opDateIsGreater)
                  .set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
                  .toDate(),
              ),
              lte(
                operations.date,
                moment(input.opDateIsGreater)
                  .set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
                  .add(1, "day")
                  .toDate(),
              ),
            )
          : undefined,
        input.opDateIsGreater && input.opDateIsLesser
          ? and(
              gte(
                operations.date,
                moment(input.opDateIsGreater)
                  .set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
                  .toDate(),
              ),
              lte(
                operations.date,
                moment(input.opDateIsLesser)
                  .set({
                    hour: 23,
                    minute: 59,
                    second: 59,
                    millisecond: 999,
                  })
                  .toDate(),
              ),
            )
          : undefined,
      );

      const txMetadataIds: number[] = [0];

      if (input.uploadedById || input.confirmedById) {
        const transactionsWithMetadata = await ctx.db
          .select({ transactionId: transactionsMetadata.transactionId })
          .from(transactionsMetadata)
          .where(
            and(
              input.uploadedById
                ? eq(transactionsMetadata.uploadedBy, input.uploadedById)
                : undefined,
              input.confirmedById
                ? eq(transactionsMetadata.confirmedBy, input.confirmedById)
                : undefined,
            ),
          );

        txMetadataIds.push(
          ...transactionsWithMetadata.map((obj) => obj.transactionId),
        );
      }

      const transactionsWhere = and(
        input.transactionId
          ? eq(transactions.id, input.transactionId)
          : undefined,
        input.transactionType
          ? eq(transactions.type, input.transactionType)
          : undefined,
        input.transactionDate
          ? sql`DATE_TRUNC('day', ${transactions.date}) = DATE ${moment(
              input.transactionDate,
            ).format("YYYY-MM-DD")}`
          : undefined,
        input.operatorEntityId
          ? inArray(transactions.operatorEntityId, input.operatorEntityId)
          : undefined,
        input.fromEntityId
          ? inArray(transactions.fromEntityId, input.fromEntityId)
          : undefined,
        input.toEntityId
          ? inArray(transactions.toEntityId, input.toEntityId)
          : undefined,
        input.currency ? eq(transactions.currency, input.currency) : undefined,
        input.method ? eq(transactions.method, input.method) : undefined,
        input.status ? eq(transactions.status, input.status) : undefined,
        input.amount ? eq(transactions.amount, input.amount) : undefined,
        input.amountIsGreater
          ? gte(transactions.amount, input.amountIsGreater)
          : undefined,
        input.amountIsLesser
          ? lte(transactions.amount, input.amountIsLesser)
          : undefined,
        input.uploadedById || input.confirmedById
          ? inArray(transactions.id, txMetadataIds)
          : undefined,
      );

      const idsThatSatisfy = await ctx.db
        .selectDistinct({ id: operations.id })
        .from(operations)
        .leftJoin(transactions, eq(operations.id, transactions.operationId))
        .where(and(operationsWhere, transactionsWhere));

      console.log(idsThatSatisfy);

      const operationsPreparedQuery = ctx.db.query.operations
        .findMany({
          where: inArray(
            operations.id,
            idsThatSatisfy.length > 0
              ? idsThatSatisfy.map((obj) => obj.id)
              : [0],
          ),
          with: {
            transactions: {
              with: {
                transactionMetadata: {
                  with: {
                    uploadedByUser: true,
                    confirmedByUser: true,
                    cancelledByUser: true,
                  },
                },
                fromEntity: {
                  with: {
                    tag: true,
                  },
                },
                toEntity: {
                  with: {
                    tag: true,
                  },
                },
                operatorEntity: {
                  with: {
                    tag: true,
                  },
                },
              },
            },
          },
          limit: sql.placeholder("oLimit"),
          offset: sql.placeholder("oOffset"),
          orderBy: desc(operations.id),
        })
        .prepare("operations_query");

      const operationsQuery = await operationsPreparedQuery.execute({
        oLimit: input.limit,
        oOffset: (input.page - 1) * input.limit,
      });

      const userPermissions = await getAllPermissions(
        ctx.redis,
        ctx.user,
        ctx.db,
      );
      const tags = await getAllTags(ctx.redis, ctx.db);

      const operationsWithPermissions = operationsQuery.map((op) => {
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
              (cashAccountOnlyTypes.includes(tx.type) ||
                tx.type === "pago por cta cte" ||
                Boolean(
                  userPermissions?.find(
                    (p) =>
                      p.name === "ADMIN" || p.name === "TRANSACTIONS_CANCEL",
                  ),
                ) ||
                Boolean(
                  userPermissions?.some((p) => {
                    const allAllowedTags = getAllChildrenTags(
                      p.entitiesTags,
                      tags,
                    );
                    return (
                      p.name === "TRANSACTIONS_CANCEL_SOME" &&
                      (p.entitiesIds?.includes(tx.fromEntityId) ||
                        allAllowedTags.includes(tx.fromEntity.tagName)) &&
                      (p.entitiesIds?.includes(tx.toEntityId) ||
                        allAllowedTags.includes(tx.toEntity.tagName))
                    );
                  }),
                ));

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
              (tx.status !== "cancelled" &&
                !currentAccountOnlyTypes.includes(tx.type)) ||
              (tx.status === "pending" &&
                (userPermissions?.some(
                  (p) =>
                    p.name === "ADMIN" ||
                    p.name === "TRANSACTIONS_VALIDATE" ||
                    (p.name === "TRANSACTIONS_VALIDATE_SOME" &&
                      (p.entitiesIds?.includes(tx.fromEntityId) ||
                        getAllChildrenTags(p.entitiesTags, tags).includes(
                          tx.fromEntity.tagName,
                        )) &&
                      (p.entitiesIds?.includes(tx.toEntityId) ||
                        getAllChildrenTags(p.entitiesTags, tags).includes(
                          tx.toEntity.tagName,
                        ))),
                ) ??
                  false));

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

      return {
        operations: operationsWithPermissions,
        count: idsThatSatisfy.length,
      };
    }),
  getOperationDetails: protectedProcedure
    .input(z.object({ operationId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const [operationDetails] = await ctx.db.query.operations.findMany({
        where: eq(operations.id, input.operationId),
        with: {
          transactions: {
            with: {
              transactionMetadata: {
                with: {
                  uploadedByUser: true,
                  confirmedByUser: true,
                  cancelledByUser: true,
                },
              },
              fromEntity: {
                with: {
                  tag: true,
                },
              },
              toEntity: {
                with: {
                  tag: true,
                },
              },
              operatorEntity: {
                with: {
                  tag: true,
                },
              },
            },
          },
        },
      });

      if (operationDetails) {
        const userPermissions = await getAllPermissions(
          ctx.redis,
          ctx.user,
          ctx.db,
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
      await undoBalances(ctx.db, undefined, input.operationId);

      const [response] = await ctx.db
        .delete(operations)
        .where(eq(operations.id, input.operationId))
        .returning();

      if (!response) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not delete operation",
        });
      }
      await logIO(
        ctx.dynamodb,
        ctx.user.id,
        "Eliminar operación",
        input,
        response,
      );

      return response;
    }),

  deleteTransaction: protectedProcedure
    .input(z.object({ transactionId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await undoBalances(ctx.db, input.transactionId, undefined);

      const [response] = await ctx.db
        .delete(transactions)
        .where(eq(transactions.id, input.transactionId))
        .returning();

      if (!response) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not delete operation",
        });
      }

      await logIO(
        ctx.dynamodb,
        ctx.user.id,
        "Eliminar transacciones",
        input,
        response,
      );

      return response;
    }),

  insights: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const monthCountSchema = z.array(
        z.object({
          day: z.string().refine((str) => moment(str).toDate()),
          operationsCount: z.string().refine((str) => parseInt(str)),
          transactionsCount: z.string().refine((str) => parseInt(str)),
        }),
      );

      const statement = sql`SELECT
      DATE_TRUNC('day', ${operations.date} AT TIME ZONE 'UTC') as "day",
      COUNT(DISTINCT ${operations.id}) as "operationsCount",
      COUNT(DISTINCT ${transactions.id}) as "transactionsCount"
    FROM
      ${operations}
      LEFT JOIN ${transactions} ON ${operations.id} = ${transactions.operationId}
    WHERE
      ${operations.date} >= NOW() - INTERVAL '7 days'
    GROUP BY
      DATE_TRUNC('day', ${operations.date} AT TIME ZONE 'UTC')
    ORDER BY
      "day" ASC;`;

      const res: postgres.RowList<Record<string, unknown>[]> =
        await ctx.db.execute(statement);

      const parsedMonthCount = monthCountSchema.parse(res);

      const [userUploadsCount] = await ctx.db
        .select({ count: count() })
        .from(transactionsMetadata)
        .where(eq(transactionsMetadata.uploadedBy, input.userId));

      const [userConfirmationsCount] = await ctx.db
        .select({ count: count() })
        .from(transactionsMetadata)
        .where(eq(transactionsMetadata.confirmedBy, input.userId));

      return {
        monthCount: parsedMonthCount,
        uploads: userUploadsCount?.count ?? 0,
        confirmations: userConfirmationsCount?.count ?? 0,
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
      const response = await ctx.db.query.operations.findFirst({
        with: {
          transactions: {
            where: input.txId ? eq(transactions.id, input.txId) : undefined,
            with: {
              movements: {
                where: input.mvId ? eq(movements.id, input.mvId) : undefined,
              },
            },
          },
        },
      });

      return response;
    }),
});
