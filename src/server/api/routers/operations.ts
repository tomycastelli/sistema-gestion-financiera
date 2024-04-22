import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import moment from "moment";
import type postgres from "postgres";
import { z } from "zod";
import { getAccountingPeriodDate, getAllChildrenTags } from "~/lib/functions";
import {
  generateMovements,
  getAllPermissions,
  getAllTags,
  getGlobalSettings,
  logIO
} from "~/lib/trpcFunctions";
import { cashAccountOnlyTypes, currentAccountOnlyTypes } from "~/lib/variables";
import {
  Status,
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
import { alias } from "drizzle-orm/pg-core";

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
      const fromEntity = alias(entities, "fromEntity");
      const toEntity = alias(entities, "toEntity");

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
            const [txIdObj] = await tx
              .insert(transactions)
              .values({
                ...transactionToInsert,
                operationId: opId,
                status:
                  cashAccountOnlyTypes.has(transactionToInsert.type) ||
                    transactionToInsert.type === "pago por cta cte"
                    ? "confirmed"
                    : "pending",
              }).returning({ id: transactions.id })


            const [insertedTxResponse] = await tx.select().from(transactions)
              .leftJoin(fromEntity, eq(transactions.fromEntityId, fromEntity.id))
              .leftJoin(toEntity, eq(transactions.toEntityId, toEntity.id))
              .where(eq(transactions.id, txIdObj!.id))

            const insertedTx = { ...insertedTxResponse!.Transactions, fromEntity: insertedTxResponse!.fromEntity!, toEntity: insertedTxResponse!.toEntity! }

            await tx.insert(transactionsMetadata).values({
              transactionId: insertedTx.id,
              uploadedBy: ctx.user.id,
              uploadedDate: new Date(),
              metadata: transactionToInsert.metadata,
            });

            list.push(insertedTx);

            if (
              cashAccountOnlyTypes.has(insertedTx.type) ||
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
              !cashAccountOnlyTypes.has(insertedTx.type) ||
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
          return { operation, transactions: list };
        });

        return response;
      } else {
        const response = await ctx.db.transaction(async (tx) => {
          const list = [];
          const [op] = await tx
            .insert(operations)
            .values({ date: input.opDate, observations: input.opObservations })
            .returning();

          for (const txToInsert of input.transactions) {
            const [txIdObj] = await tx
              .insert(transactions)
              .values({
                operationId: op!.id,
                type: txToInsert.type,
                operatorEntityId: txToInsert.operatorEntityId,
                fromEntityId: txToInsert.fromEntityId,
                toEntityId: txToInsert.toEntityId,
                currency: txToInsert.currency,
                amount: txToInsert.amount,
                method: txToInsert.method,
                status:
                  cashAccountOnlyTypes.has(txToInsert.type) ||
                    txToInsert.type === "pago por cta cte"
                    ? "confirmed"
                    : "pending",
              })
              .returning({ id: transactions.id });

            const [insertedTxResponse] = await tx.select().from(transactions)
              .leftJoin(fromEntity, eq(transactions.fromEntityId, fromEntity.id))
              .leftJoin(toEntity, eq(transactions.toEntityId, toEntity.id))
              .where(eq(transactions.id, txIdObj!.id))

            const insertedTx = { ...insertedTxResponse!.Transactions, fromEntity: insertedTxResponse!.fromEntity!, toEntity: insertedTxResponse!.toEntity! }


            list.push(insertedTx);

            await tx.insert(transactionsMetadata).values({
              transactionId: insertedTx.id,
              uploadedBy: ctx.user.id,
              uploadedDate: new Date(),
              metadata: txToInsert.metadata,
            });

            if (
              cashAccountOnlyTypes.has(insertedTx.type) ||
              insertedTx.type === "pago por cta cte"
            ) {
              await generateMovements(
                tx,
                { ...insertedTx, operation: { date: op!.date } },
                true,
                1,
                "upload",
              );
            }
            if (
              !cashAccountOnlyTypes.has(insertedTx.type) ||
              insertedTx.type === "pago por cta cte"
            ) {
              await generateMovements(
                tx,
                { ...insertedTx, operation: { date: op!.date } },
                false,
                -1,
                "upload",
              );
            }
          }

          return { operation: op!, transactions: list };
        });

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
    const getOperationsByUserQuery = ctx.db
      .select({
        id: operations.id,
        date: operations.date,
        observations: operations.observations,
        transactionsCount: count(transactions.id),
      })
      .from(operations)
      .leftJoin(transactions, eq(operations.id, transactions.operationId))
      .leftJoin(transactionsMetadata, eq(transactions.id, transactionsMetadata.transactionId))
      .where(eq(transactionsMetadata.uploadedBy, sql.placeholder("userId")))
      .groupBy(operations.id)
      .orderBy(desc(operations.id))
      .limit(5).prepare("get_operations_by_user_query");

    const response = await getOperationsByUserQuery.execute({ userId: ctx.user.id })

    return response
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
        entityId: z.array(z.number()).optional(),
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
      const { data: accountingPeriod } = await getGlobalSettings(ctx.redis, ctx.db, "accountingPeriod") as {
        name: string; data: { months: number; graceDays: number; }
      }

      const accountingPeriodDate = getAccountingPeriodDate(accountingPeriod.months, accountingPeriod.graceDays)

      const operationsWhere = and(
        input.operationId ? eq(operations.id, input.operationId) : undefined,
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
          : input.opDateIsGreater ? and(
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
        input.operatorEntityId
          ? inArray(transactions.operatorEntityId, input.operatorEntityId)
          : undefined,
        input.fromEntityId
          ? inArray(transactions.fromEntityId, input.fromEntityId)
          : undefined,
        input.toEntityId
          ? inArray(transactions.toEntityId, input.toEntityId)
          : undefined,
        input.entityId
          ? or(
            inArray(transactions.fromEntityId, input.entityId),
            inArray(transactions.toEntityId, input.entityId)
          )
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

      const response = await ctx.db.transaction(async (transaction) => {
        const idsThatSatisfyQuery = transaction
          .selectDistinct({ id: operations.id })
          .from(operations)
          .leftJoin(transactions, eq(operations.id, transactions.operationId))
          .where(and(operationsWhere, transactionsWhere)).prepare("ids_that_satisfy_query");

        const idsThatSatisfy = await idsThatSatisfyQuery.execute()
        const operationsIds = idsThatSatisfy.length > 0
          ? idsThatSatisfy.map((obj) => obj.id)
          : [0]


        const operationsPreparedQuery = transaction.query.operations
          .findMany({
            where: inArray(
              operations.id,
              operationsIds,
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
        return { operationsQuery, idsThatSatisfy }
      })

      const userPermissions = await getAllPermissions(
        ctx.redis,
        ctx.user,
        ctx.db,
      );
      const tags = await getAllTags(ctx.redis, ctx.db);

      const operationsWithPermissions = response.operationsQuery.map((op) => {
        const isInPeriod = moment(accountingPeriodDate).isBefore(op.date)

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

        const isCreateAllowed = isInPeriod && userPermissions?.find(
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
              isInPeriod &&
              tx.status !== "cancelled" &&
              (cashAccountOnlyTypes.has(tx.type) ||
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

            const isDeleteAllowed = false

            const isUpdateAllowed =
              isInPeriod &&
                tx.status !== Status.enumValues[0] &&
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

            const isValidateAllowed = isInPeriod && !currentAccountOnlyTypes.has(tx.type) && tx.status === Status.enumValues[2] &&
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
                false);

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
        count: response.idsThatSatisfy.length,
      };
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
