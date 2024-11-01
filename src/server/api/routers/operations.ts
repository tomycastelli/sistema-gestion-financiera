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
  pendingTransactions,
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
      // Estas transacciones seran insertadas directamente en la tabla comun
      const directTransactions = input.transactions.filter(
        (tx) => tx.type !== "cuenta corriente",
      );

      // Estas seran insertadas a la tabla de pending
      const pendingInput = input.transactions.filter(
        (tx) => tx.type === "cuenta corriente",
      );

      // Un map del tipo txFormId-insertedTxId donde txFormId es el id temporal generado en el form
      // Y el insertedTxId es el id generado por la base de datos
      const relatedTxIdMap = new Map<number, number>();
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

          // Inserto las pending que estan relacionadas a esa operación, se subiran con status: pending automaticamente
          // Aclaro que el status pending no tiene nada que ver con el pending de que vayan a la cola de aprobación
          if (pendingInput.length > 0) {
            const pendingToInsert = pendingInput.map((pendingTx) => ({
              operationId: opId,
              ...pendingTx,
            }));
            await tx.insert(pendingTransactions).values(pendingToInsert);
          }

          for (const txToInsert of directTransactions) {
            const [txIdObj] = await tx
              .insert(transactions)
              .values({
                ...txToInsert,
                operationId: opId,
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

            if (cashAccountOnlyTypes.has(insertedTx.type)) {
              await generateMovements(tx, txForMovement, true, 1, "upload");
            } else if (currentAccountOnlyTypes.has(insertedTx.type)) {
              await generateMovements(tx, txForMovement, false, 1, "upload");
            } else if (insertedTx.type === "pago por cta cte") {
              await generateMovements(tx, txForMovement, false, 1, "upload");
              await generateMovements(tx, txForMovement, true, 1, "upload");
            } else if (insertedTx.type === "cambio") {
              await generateMovements(tx, txForMovement, false, -1, "upload");
            }
          }

          if (directTransactions.length > 0) {
            const txMetadataToInsert = directTransactions.map((txToInsert) => ({
              transactionId: relatedTxIdMap.get(txToInsert.formId)!,
              uploadedBy: ctx.user.id,
              uploadedDate: new Date(),
              metadata: txToInsert.metadata,
              relatedTransactionId: txToInsert.relatedTransactionId
                ? relatedTxIdMap.get(txToInsert.relatedTransactionId)
                : undefined,
            }));

            await tx.insert(transactionsMetadata).values(txMetadataToInsert);
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

          // Inserto las pending que estan relacionadas a esta nueva operación, se subiran con status: pending automaticamente
          // Aclaro que el status pending no tiene nada que ver con el pending de que vayan a la cola de aprobación
          if (pendingInput.length > 0) {
            const pendingToInsert = pendingInput.map((pendingTx) => ({
              operationId: op!.id,
              ...pendingTx,
            }));
            await tx.insert(pendingTransactions).values(pendingToInsert);
          }

          for (const txToInsert of directTransactions) {
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

            const txForMovement = {
              ...insertedTx,
              operation: { date: op!.date },
            };

            if (cashAccountOnlyTypes.has(insertedTx.type)) {
              await generateMovements(tx, txForMovement, true, 1, "upload");
            } else if (currentAccountOnlyTypes.has(insertedTx.type)) {
              await generateMovements(tx, txForMovement, false, 1, "upload");
            } else if (insertedTx.type === "pago por cta cte") {
              await generateMovements(tx, txForMovement, false, 1, "upload");
              await generateMovements(tx, txForMovement, true, 1, "upload");
            } else if (insertedTx.type === "cambio") {
              await generateMovements(tx, txForMovement, false, -1, "upload");
            }
          }

          if (directTransactions.length > 0) {
            const txMetadataToInsert = directTransactions.map((txToInsert) => ({
              transactionId: relatedTxIdMap.get(txToInsert.formId)!,
              uploadedBy: ctx.user.id,
              uploadedDate: new Date(),
              metadata: txToInsert.metadata,
              relatedTransactionId: txToInsert.relatedTransactionId
                ? relatedTxIdMap.get(txToInsert.relatedTransactionId)
                : undefined,
            }));

            await tx.insert(transactionsMetadata).values(txMetadataToInsert);
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
  approvePendingTransactions: protectedLoggedProcedure
    .input(
      z.object({
        pendingTransactionsIds: z.array(z.number().int()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        ctx.user.email !== "christian@ifc.com.ar" &&
        ctx.user.email !== "tomas.castelli@ifc.com.ar"
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Only these emails can do this: christian@ifc.com.ar, tomas.castelli@ifc.com.ar",
        });
      }

      // Vamos a insertar las pending en la tabla común de transacciones y generar los movimientos
      const response = await ctx.db.transaction(async (tx) => {
        const fromEntity = alias(entities, "fromEntity");
        const toEntity = alias(entities, "toEntity");

        // Agarro las transacciones pending y las elimino de la tabla ya que dejaran de ser pending
        const pendingTransactionsToInsert = await tx
          .delete(pendingTransactions)
          .where(inArray(pendingTransactions.id, input.pendingTransactionsIds))
          .returning({
            operationId: pendingTransactions.operationId,
            type: pendingTransactions.type,
            operatorEntityId: pendingTransactions.operatorEntityId,
            fromEntityId: pendingTransactions.fromEntityId,
            toEntityId: pendingTransactions.toEntityId,
            currency: pendingTransactions.currency,
            amount: pendingTransactions.amount,
            observations: pendingTransactions.observations,
            status: pendingTransactions.status,
          });

        // Las inserto en la tabla comun
        const insertedTxsIds = await tx
          .insert(transactions)
          .values(pendingTransactionsToInsert)
          .returning({ id: transactions.id });
        const mappedTxIds = insertedTxsIds.map((tx) => tx.id);

        const insertedTxsResponse = await tx
          .select()
          .from(transactions)
          .leftJoin(fromEntity, eq(transactions.fromEntityId, fromEntity.id))
          .leftJoin(toEntity, eq(transactions.toEntityId, toEntity.id))
          .where(inArray(transactions.id, mappedTxIds));

        // Genero los movimientos
        for (const insertedTxResponse of insertedTxsResponse) {
          const [op] = await tx
            .select({ date: operations.date })
            .from(operations)
            .where(
              eq(operations.id, insertedTxResponse.Transactions.operationId),
            );
          const txForMovement = {
            ...insertedTxResponse.Transactions,
            fromEntity: insertedTxResponse.fromEntity!,
            toEntity: insertedTxResponse.toEntity!,
            operation: { date: op!.date },
          };

          if (cashAccountOnlyTypes.has(txForMovement.type)) {
            await generateMovements(tx, txForMovement, true, 1, "upload");
          } else if (currentAccountOnlyTypes.has(txForMovement.type)) {
            await generateMovements(tx, txForMovement, false, 1, "upload");
          } else if (txForMovement.type === "pago por cta cte") {
            await generateMovements(tx, txForMovement, false, 1, "upload");
            await generateMovements(tx, txForMovement, true, 1, "upload");
          } else if (txForMovement.type === "cambio") {
            await generateMovements(tx, txForMovement, false, -1, "upload");
          }
        }

        const txMetadataToInsert = insertedTxsResponse.map((pendingTx) => ({
          transactionId: pendingTx.Transactions.id,
          uploadedBy: ctx.user.id,
          uploadedDate: new Date(),
        }));

        await tx.insert(transactionsMetadata).values(txMetadataToInsert);

        return insertedTxsResponse;
      });

      return response;
    }),
  getPendingTransactions: protectedProcedure.query(async ({ ctx }) => {
    const fromEntity = alias(entities, "fromEntity");
    const toEntity = alias(entities, "toEntity");
    const operatorEntity = alias(entities, "operatorEntity");
    const fromEntityTag = alias(tag, "fromEntityTag");
    const toEntityTag = alias(tag, "toEntityTag");
    const operatorEntityTag = alias(tag, "operatorEntityTag");

    const pendingOperations = await ctx.db
      .select()
      .from(pendingTransactions)
      .leftJoin(operations, eq(pendingTransactions.operationId, operations.id))
      .leftJoin(fromEntity, eq(pendingTransactions.fromEntityId, fromEntity.id))
      .leftJoin(toEntity, eq(pendingTransactions.toEntityId, toEntity.id))
      .leftJoin(
        operatorEntity,
        eq(pendingTransactions.operatorEntityId, operatorEntity.id),
      )
      .leftJoin(fromEntityTag, eq(fromEntity.tagName, fromEntityTag.name))
      .leftJoin(toEntityTag, eq(toEntity.tagName, toEntityTag.name))
      .leftJoin(
        operatorEntityTag,
        eq(operatorEntity.tagName, operatorEntityTag.name),
      )
      .orderBy(desc(pendingTransactions.id));
    const response = pendingOperations.map((tx) => ({
      operation: tx.Operations!,
      ...tx.pendingTransactions!,
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
    return response;
  }),
  deletePendingTransactions: protectedLoggedProcedure
    .input(
      z.object({
        pendingTransactionsIds: z.array(z.number().int()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        ctx.user.email !== "christian@ifc.com.ar" &&
        ctx.user.email !== "tomas.castelli@ifc.com.ar"
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "Only these emails can do this: christian@ifc.com.ar, tomas.castelli@ifc.com.ar",
        });
      }

      const deletedPendingTransactions = await ctx.db
        .delete(pendingTransactions)
        .where(inArray(pendingTransactions.id, input.pendingTransactionsIds))
        .returning({ id: pendingTransactions.id });

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
