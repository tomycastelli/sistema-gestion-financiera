import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, lte, not, or, sql } from "drizzle-orm";
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
import { movementBalanceDirection } from "./functions";
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

  const fromEntity = alias(entities, "fromEntity");
  const toEntity = alias(entities, "toEntity");

  // Hay que hacer join con transactions para que funcionen estas conditions
  const mainConditions = and(
    eq(movements.account, sql.placeholder("account")),
    input.currency
      ? eq(transactions.currency, sql.placeholder("currency"))
      : undefined,
    input.dayInPast
      ? lte(movements.date, sql.placeholder("dayInPastLimit"))
      : undefined,
    input.fromDate && input.toDate
      ? and(
          gte(movements.date, sql.placeholder("fromDateStart")),
          lte(movements.date, sql.placeholder("toDateEnd")),
        )
      : undefined,
    input.fromDate && !input.toDate
      ? and(
          gte(movements.date, sql.placeholder("singleFromDateStart")),
          lte(movements.date, sql.placeholder("singleFromDateEnd")),
        )
      : undefined,
    // Vemos que bajar segun el tag o la entidad seleccionada
    input.entityId
      ? or(
          eq(transactions.fromEntityId, sql.placeholder("entityId")),
          eq(transactions.toEntityId, sql.placeholder("entityId")),
        )
      : undefined,
    input.entityTag
      ? and(
          or(
            eq(fromEntity.tagName, sql.placeholder("entityTag")),
            eq(toEntity.tagName, sql.placeholder("entityTag")),
          ),
          input.originEntityId
            ? or(
                eq(fromEntity.id, sql.placeholder("originEntityId")),
                eq(toEntity.id, sql.placeholder("originEntityId")),
              )
            : undefined,
          input.toEntityId
            ? or(
                eq(toEntity.id, sql.placeholder("toEntityId")),
                eq(fromEntity.id, sql.placeholder("toEntityId")),
              )
            : undefined,
          input.ignoreSameTag
            ? or(
                not(
                  eq(fromEntity.tagName, sql.placeholder("entityTagForIgnore")),
                ),
                not(
                  eq(toEntity.tagName, sql.placeholder("entityTagForIgnore")),
                ),
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
      .leftJoin(fromEntity, eq(fromEntity.id, transactions.fromEntityId))
      .leftJoin(toEntity, eq(toEntity.id, transactions.toEntityId))
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

    // Create parameters for the prepared statements
    const queryParams: Record<string, unknown> = {
      account: input.account,
      queryOffset: (input.pageNumber - 1) * input.pageSize,
      queryLimit: input.pageSize,
    };

    // Add conditional parameters only if they exist in the input
    if (input.currency) queryParams.currency = input.currency;

    if (input.dayInPast) {
      queryParams.dayInPastLimit = moment(input.dayInPast, dateFormatting.day)
        .set({
          hour: 23,
          minute: 59,
          second: 59,
          millisecond: 999,
        })
        .toISOString();
    }

    if (input.fromDate && input.toDate) {
      queryParams.fromDateStart = moment(input.fromDate)
        .startOf("day")
        .utc(true)
        .toISOString();
      queryParams.toDateEnd = moment(input.toDate)
        .endOf("day")
        .utc(true)
        .toISOString();
    } else if (input.fromDate) {
      queryParams.singleFromDateStart = moment(input.fromDate)
        .startOf("day")
        .utc(true)
        .toISOString();
      queryParams.singleFromDateEnd = moment(input.fromDate)
        .endOf("day")
        .utc(true)
        .toISOString();
    }

    if (input.entityId) queryParams.entityId = input.entityId;

    if (input.entityTag) {
      queryParams.entityTag = input.entityTag;
      // Only add this if ignoreSameTag is true to avoid duplication
      if (input.ignoreSameTag) queryParams.entityTagForIgnore = input.entityTag;
    }

    if (input.originEntityId) queryParams.originEntityId = input.originEntityId;
    if (input.toEntityId) queryParams.toEntityId = input.toEntityId;

    const [movementsData, [movementsCount]] = await Promise.all([
      movementsQuery.execute(queryParams),
      movementsCountQuery.execute(queryParams),
    ]);

    const tableDataType = z
      .object({
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
      })
      .array();

    const nestedData: z.infer<typeof tableDataType> = movementsData
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
        const { transaction } = mv;
        const { fromEntity, toEntity } = transaction;

        // Determine which entity is selected and which is the other one
        let selectedEntity;
        let otherEntity;

        if (input.entityId) {
          const isFromSelected = fromEntity.id === input.entityId;
          selectedEntity = isFromSelected ? fromEntity : toEntity;
          otherEntity = isFromSelected ? toEntity : fromEntity;
        } else if (input.entityTag) {
          if (input.originEntityId) {
            const isFromOrigin = fromEntity.id === input.originEntityId;
            selectedEntity = isFromOrigin ? fromEntity : toEntity;
            otherEntity = isFromOrigin ? toEntity : fromEntity;
          } else {
            const isFromTagged = fromEntity.tagName === input.entityTag;
            selectedEntity = isFromTagged ? fromEntity : toEntity;
            otherEntity = isFromTagged ? toEntity : fromEntity;
          }
        } else {
          selectedEntity = { id: 0, name: "", tagName: "" };
          otherEntity = { id: 0, name: "", tagName: "" };
        }

        const mvDirection = movementBalanceDirection(
          transaction.fromEntityId,
          transaction.toEntityId,
          mv.direction,
        );

        const isSelectedA = selectedEntity.id < otherEntity.id;
        const direction = isSelectedA ? mvDirection : -mvDirection;

        // Calculate balance based on the balance type
        let balance = 0;
        if (input.balanceType === "1") {
          balance = isSelectedA ? mv.balance_1 : -mv.balance_1;
        } else if (input.balanceType === "2") {
          balance = isSelectedA ? mv.balance_2a : mv.balance_2b;
        } else if (input.balanceType === "3") {
          balance = isSelectedA ? mv.balance_3a : mv.balance_3b;
        } else if (input.balanceType === "4") {
          balance = isSelectedA ? mv.balance_4a : mv.balance_4b;
        }

        // Cache amount for use in calculating ingress and egress
        const amount = transaction.amount;

        return {
          id: mv.id,
          date: mv.date,
          operationId: transaction.operationId,
          transactionId: transaction.id,
          type: mv.type,
          txType: transaction.type,
          account: mv.account,
          currency: transaction.currency,
          metadata: transaction.transactionMetadata?.metadata,
          observations: transaction.operation.observations,
          selectedEntity: selectedEntity.name,
          selectedEntityId: selectedEntity.id,
          otherEntity: otherEntity.name,
          otherEntityId: otherEntity.id,
          ingress: direction === 1 ? amount : 0,
          egress: direction === -1 ? amount : 0,
          balance,
          transactionStatus: transaction.status,
        };
      });

    return { movementsQuery: nestedData, totalRows: movementsCount!.count };
  });

  if (input.dateOrdering === "asc") {
    response.movementsQuery.reverse();
  }

  return response;
};
