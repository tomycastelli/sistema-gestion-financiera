import { and, count, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import moment from "moment";
import { z } from "zod";
import { type createTRPCContext } from "~/server/api/trpc";
import * as schema from "../server/db/schema";
import { getAccountingPeriodDate, getAllChildrenTags } from "./functions";
import {
  getAllPermissions,
  getAllTags,
  getGlobalSettings,
} from "./trpcFunctions";
import { cashAccountOnlyTypes } from "./variables";

export const getOperationsInput = z.object({
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
});

export const getOperationsProcedure = async (
  ctx: Awaited<ReturnType<typeof createTRPCContext>>,
  input: z.infer<typeof getOperationsInput>,
) => {
  const { data: accountingPeriod } = (await getGlobalSettings(
    ctx.redis,
    ctx.db,
    "accountingPeriod",
  )) as {
    name: string;
    data: { months: number; graceDays: number };
  };

  const accountingPeriodDate = getAccountingPeriodDate(
    accountingPeriod.months,
    accountingPeriod.graceDays,
  );

  const operationsWhere = and(
    input.operationId ? eq(schema.operations.id, input.operationId) : undefined,
    input.opDateIsGreater && input.opDateIsLesser
      ? and(
          gte(
            schema.operations.date,
            moment(input.opDateIsGreater)
              .set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
              .toDate(),
          ),
          lte(
            schema.operations.date,
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
      : input.opDateIsGreater
      ? and(
          gte(
            schema.operations.date,
            moment(input.opDateIsGreater)
              .set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
              .toDate(),
          ),
          lte(
            schema.operations.date,
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
      .select({ transactionId: schema.transactionsMetadata.transactionId })
      .from(schema.transactionsMetadata)
      .where(
        and(
          input.uploadedById
            ? eq(schema.transactionsMetadata.uploadedBy, input.uploadedById)
            : undefined,
          input.confirmedById
            ? eq(schema.transactionsMetadata.confirmedBy, input.confirmedById)
            : undefined,
        ),
      );

    txMetadataIds.push(
      ...transactionsWithMetadata.map((obj) => obj.transactionId),
    );
  }

  const transactionsWhere = and(
    input.transactionId
      ? eq(schema.transactions.id, input.transactionId)
      : undefined,
    input.transactionType
      ? eq(schema.transactions.type, input.transactionType)
      : undefined,
    input.operatorEntityId
      ? inArray(schema.transactions.operatorEntityId, input.operatorEntityId)
      : undefined,
    input.fromEntityId
      ? inArray(schema.transactions.fromEntityId, input.fromEntityId)
      : undefined,
    input.toEntityId
      ? inArray(schema.transactions.toEntityId, input.toEntityId)
      : undefined,
    input.entityId
      ? or(
          inArray(schema.transactions.fromEntityId, input.entityId),
          inArray(schema.transactions.toEntityId, input.entityId),
        )
      : undefined,
    input.currency
      ? eq(schema.transactions.currency, input.currency)
      : undefined,
    input.status ? eq(schema.transactions.status, input.status) : undefined,
    input.amount ? eq(schema.transactions.amount, input.amount) : undefined,
    input.amountIsGreater
      ? gte(schema.transactions.amount, input.amountIsGreater)
      : undefined,
    input.amountIsLesser
      ? lte(schema.transactions.amount, input.amountIsLesser)
      : undefined,
    input.uploadedById || input.confirmedById
      ? inArray(schema.transactions.id, txMetadataIds)
      : undefined,
  );

  const response = await ctx.db.transaction(async (transaction) => {
    const query = transaction
      .selectDistinct({ operationId: schema.transactions.operationId })
      .from(schema.transactions)
      .leftJoin(
        schema.operations,
        eq(schema.transactions.operationId, schema.operations.id),
      )
      .where(and(transactionsWhere, operationsWhere))
      .orderBy(desc(schema.transactions.operationId))
      .limit(sql.placeholder("queryLimit"))
      .offset(sql.placeholder("queryOffset"));

    const fromEntity = alias(schema.entities, "fromEntity");
    const toEntity = alias(schema.entities, "toEntity");
    const operatorEntity = alias(schema.entities, "operatorEntity");

    const fromTag = alias(schema.tag, "fromTag");
    const toTag = alias(schema.tag, "toTag");
    const operatorTag = alias(schema.tag, "operatorTag");

    const uploadedByUser = alias(schema.user, "uploadedByUser");
    const confirmedByUser = alias(schema.user, "confirmedByUser");
    const cancelledByUser = alias(schema.user, "cancelledByUser");

    const mainQuery = transaction
      .select()
      .from(schema.operations)
      .leftJoin(
        schema.transactions,
        eq(schema.operations.id, schema.transactions.operationId),
      )
      .leftJoin(fromEntity, eq(schema.transactions.fromEntityId, fromEntity.id))
      .leftJoin(fromTag, eq(fromEntity.tagName, fromTag.name))
      .leftJoin(toEntity, eq(schema.transactions.toEntityId, toEntity.id))
      .leftJoin(toTag, eq(toEntity.tagName, toTag.name))
      .leftJoin(
        operatorEntity,
        eq(schema.transactions.operatorEntityId, operatorEntity.id),
      )
      .leftJoin(operatorTag, eq(operatorEntity.tagName, operatorTag.name))
      .leftJoin(
        schema.transactionsMetadata,
        eq(schema.transactions.id, schema.transactionsMetadata.transactionId),
      )
      .leftJoin(
        uploadedByUser,
        eq(schema.transactionsMetadata.uploadedBy, uploadedByUser.id),
      )
      .leftJoin(
        confirmedByUser,
        eq(schema.transactionsMetadata.confirmedBy, confirmedByUser.id),
      )
      .leftJoin(
        cancelledByUser,
        eq(schema.transactionsMetadata.cancelledBy, cancelledByUser.id),
      )
      .where(inArray(schema.operations.id, query))
      .orderBy(desc(schema.operations.id))
      .prepare("operations_query");

    const operationsData = await mainQuery.execute({
      queryLimit: input.limit,
      queryOffset: (input.page - 1) * input.limit,
    });

    const nestedOperationType = schema.returnedOperationsSchema.extend({
      transactions: schema.returnedTransactionsSchema
        .extend({
          fromEntity: schema.returnedEntitiesSchema.extend({
            tag: schema.returnedTagSchema,
          }),
          toEntity: schema.returnedEntitiesSchema.extend({
            tag: schema.returnedTagSchema,
          }),
          operatorEntity: schema.returnedEntitiesSchema.extend({
            tag: schema.returnedTagSchema,
          }),
          transactionMetadata: schema.returnedTransactionsMetadataSchema.extend(
            {
              history: z.unknown(),
              metadata: z.unknown(),
              uploadedByUser: schema.returnedUserSchema.extend({
                permissions: z.unknown(),
              }),
              confirmedByUser: schema.returnedUserSchema.extend({
                permissions: z.unknown(),
              }),
              cancelledByUser: schema.returnedUserSchema.extend({
                permissions: z.unknown(),
              }),
            },
          ),
        })
        .array(),
    });

    const nestedOperations = operationsData.reduce(
      (acc, operation) => {
        const existingOperation = acc.find(
          (storedOp) => storedOp.id === operation.Operations.id,
        );

        if (!existingOperation) {
          const newOperation = {
            ...operation.Operations,
            transactions: [
              {
                ...operation.Transactions!,
                transactionMetadata: {
                  ...operation.TransactionsMetadata!,
                  uploadedByUser: operation.uploadedByUser!,
                  confirmedByUser: operation.confirmedByUser!,
                  cancelledByUser: operation.cancelledByUser!,
                },
                fromEntity: {
                  ...operation.fromEntity!,
                  tag: operation.fromTag!,
                },
                toEntity: { ...operation.toEntity!, tag: operation.toTag! },
                operatorEntity: {
                  ...operation.operatorEntity!,
                  tag: operation.operatorTag!,
                },
              },
            ],
          };

          acc.push(newOperation);
        } else {
          const newTransaction = {
            ...operation.Transactions!,
            transactionMetadata: {
              ...operation.TransactionsMetadata!,
              uploadedByUser: operation.uploadedByUser!,
              confirmedByUser: operation.confirmedByUser!,
              cancelledByUser: operation.cancelledByUser!,
            },
            fromEntity: {
              ...operation.fromEntity!,
              tag: operation.fromTag!,
            },
            toEntity: { ...operation.toEntity!, tag: operation.toTag! },
            operatorEntity: {
              ...operation.operatorEntity!,
              tag: operation.operatorTag!,
            },
          };

          existingOperation.transactions.push(newTransaction);
        }

        return acc;
      },
      [] as z.infer<typeof nestedOperationType>[],
    );

    const countTransactionsQuery = transaction
      .selectDistinct({ operationId: schema.transactions.operationId })
      .from(schema.transactions)
      .where(transactionsWhere)
      .orderBy(desc(schema.transactions.operationId));

    const [countQuery] = await transaction
      .select({ count: count(schema.operations.id) })
      .from(schema.operations)
      .where(
        and(
          operationsWhere,
          inArray(schema.operations.id, countTransactionsQuery),
        ),
      );

    return {
      operationsQuery: nestedOperations,
      idsThatSatisfy: countQuery!.count,
    };
  });

  const userPermissions = await getAllPermissions(ctx.redis, ctx.user, ctx.db);
  const tags = await getAllTags(ctx.redis, ctx.db);

  const operationsWithPermissions = response.operationsQuery.map((op) => {
    const isInPeriod = moment(accountingPeriodDate).isBefore(op.date);

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

    const isCreateAllowed =
      isInPeriod &&
      !op.transactions.find(
        (tx) => tx.status === schema.Status.enumValues[0],
      ) &&
      userPermissions?.find(
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
        const cuentaCorrienteAllow =
          tx.type === "cuenta corriente"
            ? ctx.user?.email === "christian@ifc.com.ar" ||
              ctx.user?.email === "tomas.castelli@ifc.com.ar"
            : true;

        const isCancelAllowed =
          cuentaCorrienteAllow &&
          isInPeriod &&
          tx.status !== "cancelled" &&
          (cashAccountOnlyTypes.has(tx.type) ||
            tx.type === "pago por cta cte" ||
            Boolean(
              userPermissions?.find(
                (p) => p.name === "ADMIN" || p.name === "TRANSACTIONS_CANCEL",
              ),
            ) ||
            Boolean(
              userPermissions?.some((p) => {
                const allAllowedTags = getAllChildrenTags(p.entitiesTags, tags);
                return (
                  p.name === "TRANSACTIONS_CANCEL_SOME" &&
                  (p.entitiesIds?.includes(tx.fromEntityId) ||
                    allAllowedTags.includes(tx.fromEntity.tagName)) &&
                  (p.entitiesIds?.includes(tx.toEntityId) ||
                    allAllowedTags.includes(tx.toEntity.tagName))
                );
              }),
            ));

        const isDeleteAllowed = false;

        const isUpdateAllowed =
          cuentaCorrienteAllow &&
          isInPeriod &&
          tx.status !== schema.Status.enumValues[0] &&
          userPermissions?.find(
            (p) => p.name === "ADMIN" || p.name === "TRANSACTIONS_UPDATE",
          )
            ? true
            : userPermissions?.find((p) => {
                const allAllowedTags = getAllChildrenTags(p.entitiesTags, tags);
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
          cuentaCorrienteAllow &&
          isInPeriod &&
          tx.type === "cambio" &&
          tx.status === schema.Status.enumValues[2] &&
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
    count: response.idsThatSatisfy,
  };
};
