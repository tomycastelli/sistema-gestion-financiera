import { TRPCError } from "@trpc/server";
import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  lte,
  not,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import moment from "moment";
import { z } from "zod";
import { type getCurrentAccountsInput } from "~/server/api/routers/movements";
import { type createTRPCContext } from "~/server/api/trpc";
import {
  entities,
  links,
  operations,
  transactions,
  transactionsMetadata,
} from "~/server/db/schema";
import { movements } from "../server/db/schema";
import { getAllChildrenTags, movementBalanceDirection } from "./functions";
import { getAllTags } from "./trpcFunctions";
import { dateFormatting } from "./variables";

export const currentAccountsProcedure = async (
  input: z.infer<typeof getCurrentAccountsInput>,
  ctx: Awaited<ReturnType<typeof createTRPCContext>>,
) => {
  let isRequestValid = false;

  if (ctx.user !== undefined) {
    isRequestValid = true;
  } else if (input.linkId && input.linkToken && input.sharedEntityId) {
    const [link] = await ctx.db
      .select()
      .from(links)
      .where(
        and(
          eq(links.id, input.linkId),
          eq(links.sharedEntityId, input.sharedEntityId),
          eq(links.password, input.linkToken),
          gte(links.expiration, new Date()),
        ),
      );

    if (link) {
      isRequestValid = true;
    }
  }

  if (!isRequestValid) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "El usuario no está registrado o el link no es válido",
    });
  }

  const tags = await getAllTags(ctx.redis, ctx.db);
  const tagAndChildrenResponse = getAllChildrenTags(input.entityTag, tags);
  const tagAndChildren =
    tagAndChildrenResponse.length > 0 ? tagAndChildrenResponse : [""];

  const fromEntity = alias(entities, "fromEntity");
  const toEntity = alias(entities, "toEntity");

  // Hay que hacer join con transactions para que funcionen estas conditions
  const mainConditions = and(
    eq(movements.account, input.account),
    input.currency ? eq(transactions.currency, input.currency) : undefined,
    input.dayInPast
      ? lte(
          movements.date,
          moment(input.dayInPast, dateFormatting.day)
            .set({
              hour: 23,
              minute: 59,
              second: 59,
              millisecond: 999,
            })
            .toDate(),
        )
      : undefined,
    input.fromDate && input.toDate
      ? and(
          gte(
            movements.date,
            moment(input.fromDate)
              .startOf("day")
              .utc(true) // Keep the same date/time but convert to UTC
              .toDate(),
          ),
          lte(
            movements.date,
            moment(input.toDate)
              .endOf("day")
              .utc(true) // Keep the same date/time but convert to UTC
              .toDate(),
          ),
        )
      : undefined,
    input.fromDate && !input.toDate
      ? and(
          gte(
            movements.date,
            moment(input.fromDate)
              .startOf("day")
              .utc(true) // Keep the same date/time but convert to UTC
              .toDate(),
          ),
          lte(
            movements.date,
            moment(input.fromDate)
              .endOf("day")
              .utc(true) // Keep the same date/time but convert to UTC
              .toDate(),
          ),
        )
      : undefined,
    // Vemos que bajar segun el tag o la entidad seleccionada
    input.entityId
      ? or(
          eq(transactions.fromEntityId, input.entityId),
          eq(transactions.toEntityId, input.entityId),
        )
      : undefined,
    input.entityTag
      ? and(
          or(
            inArray(fromEntity.tagName, tagAndChildren),
            inArray(toEntity.tagName, tagAndChildren),
          ),
          input.originEntityId
            ? or(
                eq(fromEntity.id, input.originEntityId),
                eq(toEntity.id, input.originEntityId),
              )
            : undefined,
          input.toEntityId
            ? or(
                eq(toEntity.id, input.toEntityId),
                eq(fromEntity.id, input.toEntityId),
              )
            : undefined,
          input.ignoreSameTag
            ? or(
                not(inArray(fromEntity.tagName, tagAndChildren)),
                not(inArray(toEntity.tagName, tagAndChildren)),
              )
            : undefined,
        )
      : undefined,
  );

  const response = await ctx.db.transaction(async (transaction) => {
    const movementsCountQuery = transaction
      .select({ count: count() })
      .from(movements)
      .leftJoin(transactions, eq(movements.transactionId, transactions.id))
      .where(mainConditions)
      .prepare("movements_count");

    const movementsQuery = transaction
      .select()
      .from(movements)
      .leftJoin(transactions, eq(movements.transactionId, transactions.id))
      .leftJoin(
        transactionsMetadata,
        eq(transactions.id, transactionsMetadata.transactionId),
      )
      .leftJoin(operations, eq(transactions.operationId, operations.id))
      .leftJoin(fromEntity, eq(fromEntity.id, transactions.fromEntityId))
      .leftJoin(toEntity, eq(toEntity.id, transactions.toEntityId))
      .where(mainConditions)
      .orderBy(desc(movements.date), desc(movements.id))
      .offset(sql.placeholder("queryOffset"))
      .limit(sql.placeholder("queryLimit"))
      .prepare("movements_query");

    const [movementsData, [movementsCount]] = await Promise.all([
      movementsQuery.execute({
        queryOffset: (input.pageNumber - 1) * input.pageSize,
        queryLimit: input.pageSize,
      }),
      movementsCountQuery.execute(),
    ]);

    const tableDataType = z.object({
      id: z.number(),
      date: z.date(),
      operationId: z.number(),
      transactionId: z.number(),
      observations: z.string().nullish(),
      type: z.string(),
      account: z.boolean(),
      currency: z.string(),
      txType: z.string(),
      metadata: z.unknown().nullish(),
      selectedEntityId: z.number(),
      selectedEntity: z.string(),
      otherEntityId: z.number(),
      otherEntity: z.string(),
      ingress: z.number(),
      egress: z.number(),
      balance: z.number(),
      transactionStatus: z.enum(["pending", "confirmed", "cancelled"]),
    });

    const nestedData = movementsData
      .map((obj) => ({
        ...obj.Movements,
        transaction: {
          ...obj.Transactions!,
          transactionMetadata: obj.TransactionsMetadata,
          operation: obj.Operations!,
          fromEntity:
            obj.fromEntity!.id === obj.Transactions!.fromEntityId
              ? obj.fromEntity!
              : obj.toEntity!,
          toEntity:
            obj.toEntity!.id === obj.Transactions!.toEntityId
              ? obj.toEntity!
              : obj.fromEntity!,
        },
      }))
      .map((mv) => {
        let selectedEntity = { id: 0, name: "", tagName: "" };
        let otherEntity = { id: 0, name: "", tagName: "" };
        if (input.entityId) {
          // Mi POV es la entidad del input
          selectedEntity =
            mv.transaction.fromEntity.id === input.entityId
              ? mv.transaction.fromEntity
              : mv.transaction.toEntity;
          otherEntity =
            mv.transaction.fromEntity.id === input.entityId
              ? mv.transaction.toEntity
              : mv.transaction.fromEntity;
        } else if (input.entityTag) {
          selectedEntity =
            mv.transaction.fromEntity.tagName === input.entityTag
              ? mv.transaction.fromEntity
              : mv.transaction.toEntity;
          otherEntity =
            mv.transaction.fromEntity.tagName === input.entityTag
              ? mv.transaction.toEntity
              : mv.transaction.fromEntity;
        }

        const mvDirection = movementBalanceDirection(
          mv.transaction.fromEntityId,
          mv.transaction.toEntityId,
          mv.direction,
        );
        const direction =
          selectedEntity.id < otherEntity.id ? mvDirection : -mvDirection;

        const is_selected_a = selectedEntity.id < otherEntity.id;

        let balance = 0;
        if (input.balanceType === "1") {
          balance =
            selectedEntity.id < otherEntity.id ? mv.balance_1 : -mv.balance_1;
        } else if (input.balanceType === "2") {
          balance = is_selected_a ? mv.balance_2a : mv.balance_2b;
        } else if (input.balanceType === "3") {
          balance = is_selected_a ? mv.balance_3a : mv.balance_3b;
        } else if (input.balanceType === "4") {
          balance = is_selected_a ? mv.balance_4a : mv.balance_4b;
        }
        const tableData: z.infer<typeof tableDataType> = {
          id: mv.id,
          date: mv.date,
          operationId: mv.transaction.operationId,
          transactionId: mv.transaction.id,
          type: mv.type,
          txType: mv.transaction.type,
          account: mv.account,
          currency: mv.transaction.currency,
          metadata: mv.transaction.transactionMetadata?.metadata,
          observations: mv.transaction.operation.observations,
          selectedEntity: selectedEntity.name,
          selectedEntityId: selectedEntity.id,
          otherEntity: otherEntity.name,
          otherEntityId: otherEntity.id,
          ingress: direction === 1 ? mv.transaction.amount : 0,
          egress: direction === -1 ? mv.transaction.amount : 0,
          balance,
          transactionStatus: mv.transaction.status,
        };
        return tableData;
      });

    return { movementsQuery: nestedData, totalRows: movementsCount!.count };
  });

  if (input.dateOrdering === "asc") {
    response.movementsQuery.reverse();
  }

  return response;
};
