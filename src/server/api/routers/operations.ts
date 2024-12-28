import { TRPCError } from "@trpc/server";
import {
  and,
  avg,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import moment from "moment";
import type postgres from "postgres";
import { z } from "zod";
import { generateMovements, logIO } from "~/lib/trpcFunctions";
import { cashAccountOnlyTypes, currentAccountOnlyTypes } from "~/lib/variables";
import {
  entities,
  movements,
  operations,
  tag,
  transactions,
  transactionsMetadata,
} from "~/server/db/schema";
import {
  createTRPCRouter,
  protectedLoggedProcedure,
  protectedProcedure,
} from "../trpc";
import {
  getOperationsInput,
  getOperationsProcedure,
} from "~/lib/operationsTrpcFunctions";

export const operationsRouter = createTRPCRouter({
  insertOperation: protectedLoggedProcedure
    .input(
      z.object({
        opDate: z.date(),
        opObservations: z.string().optional(),
        opId: z.number().int().optional().nullable(),
        transactions: z.array(
          z.object({
            formId: z.number().int(),
            type: z.string(),
            operatorEntityId: z.number().int(),
            fromEntityId: z.number().int(),
            toEntityId: z.number().int(),
            currency: z.string(),
            amount: z.number().positive(),
            relatedTransactionId: z.number().int().optional(),
            metadata: z
              .object({ exchange_rate: z.number().optional() })
              .optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.transactions.some((tx) => tx.fromEntityId === tx.toEntityId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Transactions must have different entities",
        });
      }

      const transactionsToInsert = input.transactions.map((tx) => ({
        ...tx,
        is_approved:
          tx.type !== "cuenta corriente" &&
          (ctx.user.permissions?.some(
            (p) => p.name === "OPERATIONS_DIRECT_UPLOAD" || p.name === "ADMIN",
          ) ??
            false),
      }));

      // Un map del tipo txFormId-insertedTxId donde txFormId es el id temporal generado en el form
      // Y el insertedTxId es el id generado por la base de datos
      const fromEntity = alias(entities, "fromEntity");
      const toEntity = alias(entities, "toEntity");

      const response = await ctx.db.transaction(
        async (tx) => {
          const relatedTxIdMap = new Map<number, number>();
          const list = [];

          const [operation] = input.opId
            ? await tx
                .select()
                .from(operations)
                .where(eq(operations.id, input.opId))
            : await tx
                .insert(operations)
                .values({
                  date: input.opDate,
                  observations: input.opObservations,
                })
                .returning();

          if (!operation) {
            throw new TRPCError({
              message: "Couldn't create or find operation",
              code: "BAD_REQUEST",
            });
          }

          for (const txToInsert of transactionsToInsert) {
            const [txIdObj] = await tx
              .insert(transactions)
              .values({
                ...txToInsert,
                operationId: operation.id,
                status:
                  cashAccountOnlyTypes.has(txToInsert.type) ||
                  txToInsert.type === "pago por cta cte"
                    ? "confirmed"
                    : "pending",
              })
              .returning({ id: transactions.id });

            relatedTxIdMap.set(txToInsert.formId, txIdObj!.id);

            const [insertedTxResponse] = await tx
              .select()
              .from(transactions)
              .leftJoin(
                fromEntity,
                eq(transactions.fromEntityId, fromEntity.id),
              )
              .leftJoin(toEntity, eq(transactions.toEntityId, toEntity.id))
              .where(eq(transactions.id, txIdObj!.id));

            const insertedTx = {
              ...insertedTxResponse!.Transactions,
              formId: txToInsert.formId,
              fromEntity: insertedTxResponse!.fromEntity!,
              toEntity: insertedTxResponse!.toEntity!,
            };

            list.push(insertedTx);

            const txForMovement = { ...insertedTx, operation };

            if (txToInsert.is_approved) {
              if (cashAccountOnlyTypes.has(insertedTx.type)) {
                await generateMovements(
                  tx,
                  txForMovement,
                  true,
                  1,
                  "upload",
                  ctx.redlock,
                );
              } else if (currentAccountOnlyTypes.has(insertedTx.type)) {
                await generateMovements(
                  tx,
                  txForMovement,
                  false,
                  1,
                  "upload",
                  ctx.redlock,
                );
              } else if (insertedTx.type === "pago por cta cte") {
                await generateMovements(
                  tx,
                  txForMovement,
                  false,
                  1,
                  "upload",
                  ctx.redlock,
                );
                await generateMovements(
                  tx,
                  txForMovement,
                  true,
                  1,
                  "upload",
                  ctx.redlock,
                );
              } else if (insertedTx.type === "cambio") {
                await generateMovements(
                  tx,
                  txForMovement,
                  false,
                  -1,
                  "upload",
                  ctx.redlock,
                );
              }
            }
          }

          const txMetadataToInsert = transactionsToInsert.map((txToInsert) => ({
            transactionId: relatedTxIdMap.get(txToInsert.formId)!,
            uploadedBy: ctx.user.id,
            uploadedDate: new Date(),
            metadata: txToInsert.metadata,
            relatedTransactionId: txToInsert.relatedTransactionId
              ? relatedTxIdMap.get(txToInsert.relatedTransactionId)
              : undefined,
          }));

          await tx.insert(transactionsMetadata).values(txMetadataToInsert);

          return { operation, transactions: list };
        },
        {
          isolationLevel: "serializable",
          deferrable: true,
        },
      );

      await logIO(
        ctx.dynamodb,
        ctx.user.id,
        "Insertar operación",
        input,
        response,
      );

      return response;
    }),
  approvePendingTransactions: protectedLoggedProcedure
    .input(
      z.object({
        pendingTransactionsIds: z.array(z.number().int()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        !ctx.user.permissions?.some(
          (p) => p.name === "OPERATIONS_PENDING_APPROVE" || p.name === "ADMIN",
        )
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Only these emails can do this: christian@ifc.com.ar, tomas.castelli@ifc.com.ar",
        });
      }

      const fromEntity = alias(entities, "fromEntity");
      const toEntity = alias(entities, "toEntity");

      const response = await ctx.db.transaction(
        async (tx) => {
          const list = [];
          for (const txId of input.pendingTransactionsIds) {
            const [insertedTxResponse] = await tx
              .select()
              .from(transactions)
              .leftJoin(
                fromEntity,
                eq(transactions.fromEntityId, fromEntity.id),
              )
              .leftJoin(toEntity, eq(transactions.toEntityId, toEntity.id))
              .where(eq(transactions.id, txId));

            if (!insertedTxResponse) {
              throw new TRPCError({
                message: "Invalid transaction id",
                code: "BAD_REQUEST",
              });
            } else if (insertedTxResponse.Transactions.is_approved) {
              throw new TRPCError({
                message: "Transaction id is already approved",
                code: "BAD_REQUEST",
              });
            }

            await tx
              .update(transactions)
              .set({ is_approved: true })
              .where(eq(transactions.id, txId));

            const [operation] = await tx
              .select()
              .from(operations)
              .where(
                eq(operations.id, insertedTxResponse.Transactions.operationId),
              );

            const insertedTx = {
              ...insertedTxResponse.Transactions,
              fromEntity: insertedTxResponse.fromEntity!,
              toEntity: insertedTxResponse.toEntity!,
            };

            list.push(insertedTx);

            const txForMovement = { ...insertedTx, operation: operation! };
            if (cashAccountOnlyTypes.has(insertedTx.type)) {
              await generateMovements(
                tx,
                txForMovement,
                true,
                1,
                "upload",
                ctx.redlock,
              );
            } else if (currentAccountOnlyTypes.has(insertedTx.type)) {
              await generateMovements(
                tx,
                txForMovement,
                false,
                1,
                "upload",
                ctx.redlock,
              );
            } else if (insertedTx.type === "pago por cta cte") {
              await generateMovements(
                tx,
                txForMovement,
                false,
                1,
                "upload",
                ctx.redlock,
              );
              await generateMovements(
                tx,
                txForMovement,
                true,
                1,
                "upload",
                ctx.redlock,
              );
            } else if (insertedTx.type === "cambio") {
              await generateMovements(
                tx,
                txForMovement,
                false,
                -1,
                "upload",
                ctx.redlock,
              );
            }
          }

          return list;
        },
        {
          isolationLevel: "serializable",
          deferrable: true,
        },
      );

      await logIO(
        ctx.dynamodb,
        ctx.user.id,
        "Aprobar transacción",
        input,
        response,
      );

      return response;
    }),
  getPendingTransactions: protectedProcedure
    .input(
      z.object({
        page: z.number().int(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const pageSize = 30;

      const fromEntity = alias(entities, "fromEntity");
      const toEntity = alias(entities, "toEntity");
      const operatorEntity = alias(entities, "operatorEntity");
      const fromEntityTag = alias(tag, "fromEntityTag");
      const toEntityTag = alias(tag, "toEntityTag");
      const operatorEntityTag = alias(tag, "operatorEntityTag");

      const [pendingTransactionsCount] = await ctx.db
        .select({ count: count() })
        .from(transactions)
        .where(eq(transactions.is_approved, false));

      const pendingTransactions = await ctx.db
        .select()
        .from(transactions)
        .leftJoin(operations, eq(transactions.operationId, operations.id))
        .leftJoin(fromEntity, eq(transactions.fromEntityId, fromEntity.id))
        .leftJoin(toEntity, eq(transactions.toEntityId, toEntity.id))
        .leftJoin(
          operatorEntity,
          eq(transactions.operatorEntityId, operatorEntity.id),
        )
        .leftJoin(fromEntityTag, eq(fromEntity.tagName, fromEntityTag.name))
        .leftJoin(toEntityTag, eq(toEntity.tagName, toEntityTag.name))
        .leftJoin(
          operatorEntityTag,
          eq(operatorEntity.tagName, operatorEntityTag.name),
        )
        .where(eq(transactions.is_approved, false))
        .limit(pageSize)
        .offset((input.page - 1) * pageSize)
        .orderBy(desc(transactions.id));
      const response = pendingTransactions.map((tx) => ({
        operation: tx.Operations!,
        ...tx.Transactions!,
        fromEntity: {
          ...tx.fromEntity!,
          tag: tx.fromEntityTag!,
        },
        toEntity: {
          ...tx.toEntity!,
          tag: tx.toEntityTag!,
        },
        operatorEntity: {
          ...tx.operatorEntity!,
          tag: tx.operatorEntityTag!,
        },
      }));
      return { transactions: response, count: pendingTransactionsCount!.count };
    }),
  deletePendingTransactions: protectedLoggedProcedure
    .input(
      z.object({
        pendingTransactionsIds: z.array(z.number().int()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        !ctx.user.permissions?.some(
          (p) => p.name === "OPERATIONS_PENDING_APPROVE" || p.name === "ADMIN",
        )
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Only these emails can do this: christian@ifc.com.ar, tomas.castelli@ifc.com.ar",
        });
      }

      // Chequeo que sean todos sin aprobar
      const [unapproved] = await ctx.db
        .select({ count: count() })
        .from(transactions)
        .where(
          and(
            inArray(transactions.id, input.pendingTransactionsIds),
            eq(transactions.is_approved, false),
          ),
        );

      if (unapproved?.count !== input.pendingTransactionsIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Not all pased tx ids are unapproved",
        });
      }

      const deletedPendingTransactions = await ctx.db
        .delete(transactions)
        .where(inArray(transactions.id, input.pendingTransactionsIds))
        .returning({ id: transactions.id });

      return deletedPendingTransactions;
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
      .leftJoin(
        transactionsMetadata,
        eq(transactions.id, transactionsMetadata.transactionId),
      )
      .where(eq(transactionsMetadata.uploadedBy, sql.placeholder("userId")))
      .groupBy(operations.id)
      .orderBy(desc(operations.id))
      .limit(5)
      .prepare("get_operations_by_user_query");

    const response = await getOperationsByUserQuery.execute({
      userId: ctx.user.id,
    });

    return response;
  }),
  getOperations: protectedLoggedProcedure
    .input(getOperationsInput)
    .query(async ({ ctx, input }) => {
      const response = await getOperationsProcedure(ctx, input);
      return response;
    }),
  userUploaded: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const monthCountSchema = z.array(
        z.object({
          day: z.string().refine((str) => moment(str).toDate()),
          operationsCount: z.string().refine((str) => Number.parseInt(str)),
          transactionsCount: z.string().refine((str) => Number.parseInt(str)),
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
  insights: protectedProcedure
    .input(
      z
        .object({
          entityId: z.number().optional().nullish(),
          entityTag: z.string().optional().nullish(),
          type: z.enum(["exchangeRate"]),
        })
        .superRefine((obj, ctx) => {
          if (!obj.entityId && !obj.entityTag) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Es necesario una entidad o un tag",
            });
          }
        }),
    )
    .query(async ({ ctx, input }) => {
      switch (input.type) {
        case "exchangeRate": {
          const fromEntity = alias(entities, "fromEntity");
          const toEntity = alias(entities, "toEntity");

          const [exchangeAvg] = await ctx.db
            .select({
              average: avg(
                sql`AVG(CAST(${transactionsMetadata.metadata} ->> 'exchange_rate' AS FLOAT))`,
              ),
            })
            .from(transactionsMetadata)
            .leftJoin(
              transactions,
              eq(transactions.id, transactionsMetadata.transactionId),
            )
            .leftJoin(fromEntity, eq(fromEntity.id, transactions.fromEntityId))
            .leftJoin(toEntity, eq(toEntity.id, transactions.toEntityId))
            .leftJoin(operations, eq(operations.id, transactions.operationId))
            .where(
              and(
                isNotNull(
                  sql`${transactionsMetadata.metadata} ->> 'exchange_rate'`,
                ),
                input.entityId
                  ? or(
                      eq(fromEntity.id, input.entityId),
                      eq(toEntity.id, input.entityId),
                    )
                  : input.entityTag
                  ? or(
                      eq(fromEntity.tagName, input.entityTag),
                      eq(toEntity.tagName, input.entityTag),
                    )
                  : undefined,
              ),
            );

          if (exchangeAvg?.average) {
            return Number.parseFloat(exchangeAvg.average);
          } else {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Exchange rate average not found",
            });
          }
        }
        default:
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Requires a type input",
          });
      }
    }),
});
