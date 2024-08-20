import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  not,
  or,
  sql,
  type ExtractTablesWithRelations,
} from "drizzle-orm";
import { alias, type PgTransaction } from "drizzle-orm/pg-core";
import {
  type PostgresJsDatabase,
  type PostgresJsQueryResultHKT,
} from "drizzle-orm/postgres-js";
import type Redis from "ioredis";
import { type User } from "lucia";
import moment from "moment";
import { ZodError, z } from "zod";
import { type createTRPCContext } from "~/server/api/trpc";
import { type dynamodb } from "~/server/dynamodb";
import type * as schema from "../server/db/schema";
import {
  balances,
  entities,
  globalSettings,
  links,
  movements,
  operations,
  role,
  transactions,
  transactionsMetadata,
  type insertMovementsSchema,
  type returnedTransactionsSchema,
} from "../server/db/schema";
import { getAllChildrenTags, movementBalanceDirection } from "./functions";
import { PermissionSchema, mergePermissions } from "./permissionsTypes";
import { dateFormatting } from "./variables";
import { type getCurrentAccountsInput } from "~/server/api/routers/movements";

export const getAllPermissions = async (
  redis: Redis,
  user: User | null | undefined,
  db: PostgresJsDatabase<typeof schema>,
) => {
  if (!user) {
    return [];
  }

  const cachedResponseString = await redis.get(`user_permissions|${user.id}`);
  if (cachedResponseString) {
    const cachedResponse: z.infer<typeof PermissionSchema> =
      JSON.parse(cachedResponseString);
    return cachedResponse;
  }

  if (user.roleId) {
    const roleFound = await db.query.role.findFirst({
      where: eq(role.id, user.roleId),
    });

    if (roleFound?.permissions && user?.permissions) {
      try {
        const permissions = PermissionSchema.parse(roleFound.permissions);

        const merged = mergePermissions(permissions, user.permissions);

        await redis.set(
          `user_permissions|${user.id}`,
          JSON.stringify(merged),
          "EX",
          3600,
        );

        return merged;
      } catch (e) {
        if (e instanceof ZodError) {
          throw new TRPCError({
            code: "PARSE_ERROR",
            message: e.toString(),
          });
        }
      }
    }
    if (roleFound?.permissions) {
      const permissions = PermissionSchema.parse(roleFound.permissions);
      await redis.set(
        `user_permissions|${user.id}`,
        JSON.stringify(permissions),
        "EX",
        3600,
      );

      return permissions;
    }
  }
  if (user?.permissions) {
    await redis.set(
      `user_permissions|${user.id}`,
      JSON.stringify(user.permissions),
      "EX",
      3600,
    );

    return user.permissions;
  }
  return [];
};

export const getAllTags = async (
  redis: Redis,
  db: PostgresJsDatabase<typeof schema>,
) => {
  await redis.del("tags");
  const cachedTagsString = await redis.get("tags");
  if (cachedTagsString) {
    const cachedTags: typeof tags = JSON.parse(cachedTagsString);
    return cachedTags;
  }

  const tags = await db.query.tag.findMany({
    with: {
      children: true,
    },
  });

  if (tags) {
    await redis.set("tags", JSON.stringify(tags), "EX", 3600);
  }
  return tags;
};

export const getAllEntities = async (
  redis: Redis,
  db: PostgresJsDatabase<typeof schema>,
) => {
  const cachedEntities: string | null = await redis.get("entities");

  if (cachedEntities) {
    const parsedEntities: typeof entities = JSON.parse(cachedEntities);

    return parsedEntities;
  }

  const entities = await db.query.entities.findMany({
    with: {
      tag: true,
    },
    columns: {
      id: true,
      name: true,
    },
  });

  if (!entities)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Entities returned empty from database",
    });

  const mainTag = (await getGlobalSettings(redis, db, "mainTag")) as {
    name: string;
    data: { tag: string };
  };

  const tags = await getAllTags(redis, db);

  const mainTags = getAllChildrenTags(mainTag.data.tag, tags);

  const sortedEntities = entities.sort((a, b) => {
    if (mainTags.includes(a.tag.name) && !mainTags.includes(b.tag.name)) {
      return -1;
    } else if (
      !mainTags.includes(a.tag.name) &&
      mainTags.includes(b.tag.name)
    ) {
      return 1;
    } else {
      return 0;
    }
  });

  await redis.set("entities", JSON.stringify(sortedEntities), "EX", 3600);

  return sortedEntities;
};

export const generateMovements = async (
  transaction: PgTransaction<
    PostgresJsQueryResultHKT,
    typeof schema,
    ExtractTablesWithRelations<typeof schema>
  >,
  tx: z.infer<typeof returnedTransactionsSchema> & {
    operation: { date: Date };
    fromEntity: { id: number; tagName: string };
    toEntity: { id: number; tagName: string };
  },
  account: boolean,
  direction: number,
  type: string,
) => {
  const movementsResponse = [];

  const mvDate = tx.operation.date;

  const selectedEntity =
    tx.fromEntityId < tx.toEntityId ? tx.fromEntity : tx.toEntity;
  const otherEntity =
    tx.fromEntityId < tx.toEntityId ? tx.toEntity : tx.fromEntity;

  // Voy a tener que hacer lo mismo tres veces, una para balance entre entidades, otras dos para entidad-tag / tag-entidad
  for (let index = 0; index < 3; index++) {
    let changeAmount = 0;

    if (index === 0) {
      // Esto lo uso para calcular direccion el primer caso de from --> to
      changeAmount =
        movementBalanceDirection(tx.fromEntityId, tx.toEntityId, direction) *
        tx.amount;
    } else if (index === 1) {
      // Defino que el POV sera el tagName, porque cuando es el To, uso la misma direccion porque es el que recibe
      changeAmount = tx.amount * direction;
    } else if (index === 2) {
      // Y cuando es el From, invierto la direccion porque es el que envia
      changeAmount = tx.amount * direction * -1;
    }

    const movementsArray: z.infer<typeof insertMovementsSchema>[] = [];

    const entitiesQuery =
      index === 0
        ? and(
            eq(balances.selectedEntityId, selectedEntity.id),
            eq(balances.otherEntityId, otherEntity.id),
          )
        : index === 1
        ? and(
            eq(balances.selectedEntityId, tx.fromEntity.id),
            eq(balances.tagName, tx.toEntity.tagName),
          )
        : index === 2
        ? and(
            eq(balances.selectedEntityId, tx.toEntity.id),
            eq(balances.tagName, tx.fromEntity.tagName),
          )
        : undefined;

    const balanceEntitiesToInsert =
      index === 0
        ? { selectedEntityId: selectedEntity.id, otherEntityId: otherEntity.id }
        : index === 1
        ? { selectedEntityId: tx.fromEntity.id, tagName: tx.toEntity.tagName }
        : index === 2
        ? {
            selectedEntityId: tx.toEntity.id,
            tagName: tx.fromEntity.tagName,
          }
        : undefined;

    // Busco el ultimo balance relacionado al movimiento por hacer
    const [balance] = await transaction
      .select({
        id: balances.id,
        amount: balances.balance,
        date: balances.date,
      })
      .from(balances)
      .where(
        and(
          eq(balances.account, account),
          eq(balances.currency, tx.currency),
          entitiesQuery,
        ),
      )
      .orderBy(desc(balances.date))
      .limit(1);

    // Busco el balance mas reciente previo al que voy a insertar
    const [beforeBalance] = await transaction
      .select({ amount: balances.balance })
      .from(balances)
      .where(
        and(
          eq(balances.account, account),
          eq(balances.currency, tx.currency),
          lt(balances.date, moment(mvDate).startOf("day").toDate()),
          entitiesQuery,
        ),
      )
      .orderBy(desc(balances.date))
      .limit(1);

    if (!balance) {
      const [response] = await transaction
        .insert(balances)
        .values({
          ...balanceEntitiesToInsert!,
          account: account,
          currency: tx.currency,
          date: moment(mvDate).startOf("day").toDate(),
          balance: changeAmount,
        })
        .returning();

      movementsArray.push({
        transactionId: tx.id,
        direction,
        type,
        account,
        balance: response!.balance,
        balanceId: response!.id,
        entitiesMovementId: index !== 0 ? movementsResponse[0]!.id : null,
      });
    } else {
      // Si el balance existe
      if (moment(mvDate).isBefore(balance.date, "day")) {
        // Si el dia de la tx o op es antes del ultimo balance
        // Buscare si existe un balance de esa fecha previa y lo actualizo
        const [oldBalance] = await transaction
          .update(balances)
          .set({ balance: sql`${balances.balance} + ${changeAmount}` })
          .where(
            and(
              eq(balances.account, account),
              eq(balances.currency, tx.currency),
              eq(balances.date, moment(mvDate).startOf("day").toDate()),
              entitiesQuery,
            ),
          )
          .returning({ id: balances.id, amount: balances.balance });

        if (!oldBalance) {
          // Si no existe un balance de esa fecha previa, creo uno donde el monto sea el ultimo monto previo a ese mas el cambio
          const [newBalance] = await transaction
            .insert(balances)
            .values({
              account,
              currency: tx.currency,
              date: moment(mvDate).startOf("day").toDate(),
              ...balanceEntitiesToInsert!,
              balance: beforeBalance
                ? beforeBalance.amount + changeAmount
                : changeAmount,
            })
            .returning({ id: balances.id, amount: balances.balance });

          if (newBalance) {
            // Creo un movimiento con el nuevo balance creado
            movementsArray.push({
              transactionId: tx.id,
              direction: direction,
              account: account,
              type: type,
              balance: newBalance.amount,
              balanceId: newBalance.id,
              entitiesMovementId: index !== 0 ? movementsResponse[0]!.id : null,
            });
          }
        } else {
          // Busco el balance del movimiento realizado ese dia que este justo antes del que voy a insertar en cuanto a fecha
          const [movement] = await transaction
            .select({ amount: movements.balance })
            .from(movements)
            .leftJoin(
              transactions,
              eq(movements.transactionId, transactions.id),
            )
            .leftJoin(operations, eq(transactions.operationId, operations.id))
            .where(
              and(
                eq(movements.balanceId, oldBalance.id),
                lte(operations.date, mvDate),
              ),
            )
            .orderBy(desc(operations.date), desc(movements.id))
            .limit(1);

          // Creo un movimiento con el balance cambiado
          movementsArray.push({
            transactionId: tx.id,
            direction,
            account,
            type,
            balance: movement
              ? movement.amount + changeAmount
              : beforeBalance
              ? beforeBalance.amount + changeAmount
              : changeAmount,
            balanceId: oldBalance.id,
            entitiesMovementId: index !== 0 ? movementsResponse[0]!.id : null,
          });
        }

        // Actualizo todos los balances posteriores a la fecha previa cambiada
        await transaction
          .update(balances)
          .set({ balance: sql`${balances.balance} + ${changeAmount}` })
          .where(
            and(
              gt(balances.date, moment(mvDate).startOf("day").toDate()),
              eq(balances.account, account),
              eq(balances.currency, tx.currency),
              entitiesQuery,
            ),
          );
      } else if (moment(mvDate).isSame(balance.date, "day")) {
        // Si la fecha de la tx o op es la misma que el ultimo balance, cambio el ultimo balance
        await transaction
          .update(balances)
          .set({ balance: sql`${balances.balance} + ${changeAmount}` })
          .where(eq(balances.id, balance.id));

        // Busco el balance del movimiento realizado ese dia que este justo antes del que voy a insertar en cuanto a fecha
        const [movement] = await transaction
          .select({ amount: movements.balance })
          .from(movements)
          .leftJoin(transactions, eq(movements.transactionId, transactions.id))
          .leftJoin(operations, eq(transactions.operationId, operations.id))
          .where(
            and(
              eq(movements.balanceId, balance.id),
              lte(operations.date, mvDate),
            ),
          )
          .orderBy(desc(operations.date), desc(movements.id))
          .limit(1);

        // Creo un movimiento con el balance cambiado
        movementsArray.push({
          transactionId: tx.id,
          direction,
          account,
          type,
          balance: movement
            ? movement.amount + changeAmount
            : beforeBalance
            ? beforeBalance.amount + changeAmount
            : changeAmount,
          balanceId: balance.id,
          entitiesMovementId: index !== 0 ? movementsResponse[0]!.id : null,
        });
      } else {
        // Si la fecha de la tx o op es posterior al ultimo balance, creo una nueva
        const [newBalance] = await transaction
          .insert(balances)
          .values({
            account,
            currency: tx.currency,
            ...balanceEntitiesToInsert!,
            date: moment(mvDate).startOf("day").toDate(),
            balance: balance.amount + changeAmount,
          })
          .returning({ id: balances.id, amount: balances.balance });

        if (newBalance) {
          movementsArray.push({
            transactionId: tx.id,
            direction,
            account,
            type,
            balance: newBalance.amount,
            balanceId: newBalance.id,
            entitiesMovementId: index !== 0 ? movementsResponse[0]!.id : null,
          });
        }
      }
    }

    // Actualizo los movimientos posteriores al que voy a insertar
    const response = await transaction
      .select({ id: movements.id })
      .from(movements)
      .leftJoin(transactions, eq(movements.transactionId, transactions.id))
      .leftJoin(operations, eq(transactions.operationId, operations.id))
      .leftJoin(balances, eq(movements.balanceId, balances.id))
      .where(
        and(
          eq(movements.account, account),
          eq(transactions.currency, tx.currency),
          entitiesQuery,
          gt(operations.date, mvDate),
        ),
      );
    const movementsIds =
      response.length > 0 ? response.map((obj) => obj.id) : [0];

    await transaction
      .update(movements)
      .set({ balance: sql`${movements.balance} + ${changeAmount}` })
      .where(inArray(movements.id, movementsIds));

    const [createdMovement] = await transaction
      .insert(movements)
      .values(movementsArray)
      .returning();

    movementsResponse.push(createdMovement!);
  }

  return movementsResponse;
};

export const undoMovements = async (
  transaction: PgTransaction<
    PostgresJsQueryResultHKT,
    typeof schema,
    ExtractTablesWithRelations<typeof schema>
  >,
  tx: {
    id: number;
    fromEntity: { id: number };
    toEntity: { id: number; tagName: string };
    amount: number;
    currency: string;
    operation: { date: Date };
  },
) => {
  const deletedMovements = await transaction
    .delete(movements)
    .where(eq(movements.transactionId, tx.id))
    .returning();

  for (const deletedMovement of deletedMovements) {
    const [relatedBalance] = await transaction
      .select()
      .from(balances)
      .where(eq(balances.id, deletedMovement.balanceId));

    let changedAmount = 0;

    if (deletedMovement.entitiesMovementId) {
      // Si el to es el tagName, como es el POV del tagname, tomo la direccion como viene
      changedAmount =
        tx.toEntity.tagName === relatedBalance?.tagName
          ? deletedMovement.direction * tx.amount
          : deletedMovement.direction * tx.amount * -1;
    } else {
      changedAmount =
        movementBalanceDirection(
          tx.fromEntity.id,
          tx.toEntity.id,
          deletedMovement.direction,
        ) * tx.amount;
    }

    const selectedEntityId = relatedBalance!.selectedEntityId!;
    const otherEntityId = relatedBalance!.otherEntityId!;
    const tagName = relatedBalance!.tagName;

    const balanceQuery = deletedMovement.entitiesMovementId
      ? and(
          eq(balances.selectedEntityId, selectedEntityId),
          eq(balances.tagName, tagName ?? ""),
        )
      : and(
          eq(balances.selectedEntityId, selectedEntityId),
          eq(balances.otherEntityId, otherEntityId),
        );

    // Retrocedo el balance relacionado a ese movimiento y los posteriores
    await transaction
      .update(balances)
      .set({ balance: sql`${balances.balance} - ${changedAmount}` })
      .where(
        or(
          eq(balances.id, deletedMovement.balanceId),
          and(
            eq(balances.account, deletedMovement.account),
            eq(balances.currency, tx.currency),
            balanceQuery,
            gt(balances.date, relatedBalance!.date),
          ),
        ),
      );

    // Retrocedo el balance de todos los movimientos posteriores
    const mvsToUpdate = await transaction
      .select({ id: movements.id })
      .from(movements)
      .leftJoin(transactions, eq(movements.transactionId, transactions.id))
      .leftJoin(operations, eq(transactions.operationId, operations.id))
      .leftJoin(balances, eq(movements.balanceId, balances.id))
      .where(
        and(
          eq(balances.account, deletedMovement.account),
          eq(balances.currency, tx.currency),
          balanceQuery,
          or(
            gt(operations.date, tx.operation.date),
            and(
              eq(operations.date, tx.operation.date),
              gt(movements.id, deletedMovement.id),
            ),
          ),
        ),
      );

    const mvsIds =
      mvsToUpdate.length > 0 ? mvsToUpdate.map((obj) => obj.id) : [0];

    await transaction
      .update(movements)
      .set({ balance: sql`${movements.balance} - ${changedAmount}` })
      .where(inArray(movements.id, mvsIds));
  }

  return deletedMovements;
};

export const logIO = async (
  dynamodbClient: typeof dynamodb,
  userId: string,
  name: string,
  input: object,
  output: object,
): Promise<void> => {
  const { client, PutCommand, tableName } = dynamodbClient;

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: "log",
        sk: Date.now().toString(),
        userId,
        name,
        input,
        output,
      },
    }),
  );
};

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
    input.entityId
      ? and(
          input.toEntityId
            ? or(
                and(
                  eq(balances.selectedEntityId, input.toEntityId),
                  eq(balances.otherEntityId, input.entityId),
                ),
                and(
                  eq(balances.selectedEntityId, input.entityId),
                  eq(balances.otherEntityId, input.toEntityId),
                ),
              )
            : or(
                eq(balances.selectedEntityId, input.entityId),
                eq(balances.otherEntityId, input.entityId),
              ),
          isNull(movements.entitiesMovementId),
        )
      : undefined,
    input.entityTag
      ? and(
          or(
            and(
              inArray(fromEntity.tagName, tagAndChildren),
              input.toEntityId
                ? eq(toEntity.id, input.toEntityId)
                : not(inArray(toEntity.tagName, tagAndChildren)),
            ),
            and(
              input.toEntityId
                ? eq(fromEntity.id, input.toEntityId)
                : not(inArray(fromEntity.tagName, tagAndChildren)),
              inArray(toEntity.tagName, tagAndChildren),
            ),
          ),
          isNull(movements.entitiesMovementId),
        )
      : undefined,
    input.currency ? eq(transactions.currency, input.currency) : undefined,
    input.dayInPast
      ? lte(
          operations.date,
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
            operations.date,
            moment(input.fromDate)
              .set({
                hour: 0,
                minute: 0,
                second: 0,
                millisecond: 0,
              })
              .toDate(),
          ),
          lte(
            operations.date,
            moment(input.toDate)
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
    input.fromDate && !input.toDate
      ? and(
          gte(
            operations.date,
            moment(input.fromDate)
              .set({
                hour: 0,
                minute: 0,
                second: 0,
                millisecond: 0,
              })
              .toDate(),
          ),
          lte(
            operations.date,
            moment(input.fromDate)
              .set({
                hour: 0,
                minute: 0,
                second: 0,
                millisecond: 0,
              })
              .add(1, "day")
              .toDate(),
          ),
        )
      : undefined,
  );

  const movementsConditions = and(
    typeof input.account === "boolean"
      ? eq(movements.account, input.account)
      : undefined,
  );

  const response = await ctx.db.transaction(async (transaction) => {
    const movementsCountQuery = transaction
      .select({ count: count() })
      .from(movements)
      .leftJoin(balances, eq(movements.balanceId, balances.id))
      .leftJoin(transactions, eq(movements.transactionId, transactions.id))
      .leftJoin(fromEntity, eq(fromEntity.id, balances.selectedEntityId))
      .leftJoin(toEntity, eq(toEntity.id, balances.otherEntityId))
      .leftJoin(operations, eq(transactions.operationId, operations.id))
      .where(and(movementsConditions, mainConditions))
      .prepare("movements_count");

    const [movementsCount] = await movementsCountQuery.execute();

    const movementsQuery = transaction
      .select()
      .from(movements)
      .leftJoin(transactions, eq(movements.transactionId, transactions.id))
      .leftJoin(
        transactionsMetadata,
        eq(transactions.id, transactionsMetadata.transactionId),
      )
      .leftJoin(operations, eq(transactions.operationId, operations.id))
      .leftJoin(balances, eq(movements.balanceId, balances.id))
      .leftJoin(fromEntity, eq(fromEntity.id, balances.selectedEntityId))
      .leftJoin(toEntity, eq(toEntity.id, balances.otherEntityId))
      .where(and(movementsConditions, mainConditions))
      .orderBy(
        input.dateOrdering === "desc"
          ? desc(operations.date)
          : asc(operations.date),
        input.dateOrdering === "desc" ? desc(movements.id) : asc(movements.id),
      )
      .offset(sql.placeholder("queryOffset"))
      .limit(sql.placeholder("queryLimit"))
      .prepare("movements_query");

    const movementsData = await movementsQuery.execute({
      queryOffset: (input.pageNumber - 1) * input.pageSize,
      queryLimit: input.pageSize,
    });

    const tableDataType = z.object({
      id: z.number(),
      date: z.string(),
      operationId: z.number(),
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
    });

    if (input.entityTag && input.groupInTag) {
      // Agarro los movimientos en su version de Tag
      const ids = movementsData.map((obj) => obj.Movements.id);

      const tagBalanceMovements = await transaction
        .select({
          entitiesMovementId: movements.entitiesMovementId,
          balance: movements.balance,
        })
        .from(movements)
        .leftJoin(balances, eq(movements.balanceId, balances.id))
        .where(
          and(
            inArray(movements.entitiesMovementId, ids.length > 0 ? ids : [0]),
            eq(balances.tagName, input.entityTag),
          ),
        );

      const nestedData = movementsData
        .map((obj) => ({
          ...obj.Movements!,
          balance: tagBalanceMovements.find(
            (mv) => mv.entitiesMovementId === obj.Movements!.id,
          )!.balance,
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
          // Mi POV es la entidad que pertenece al tag
          const selectedEntity =
            mv.transaction.fromEntity.tagName === input.entityTag
              ? mv.transaction.fromEntity
              : mv.transaction.toEntity;
          const otherEntity =
            mv.transaction.fromEntity.tagName === input.entityTag
              ? mv.transaction.toEntity
              : mv.transaction.fromEntity;

          // Es una entrada si al generar el movimiento, este sumo al balance del Tag con la entidad
          const direction =
            mv.transaction.toEntity.tagName === input.entityTag
              ? mv.direction
              : -mv.direction;
          // El balance es del punto de vista del tag

          const tableData: z.infer<typeof tableDataType> = {
            id: mv.id,
            date: moment(mv.transaction.operation.date).format(
              "DD-MM-YYYY HH:mm",
            ),
            operationId: mv.transaction.operationId,
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
            balance: mv.balance,
          };
          return tableData;
        });
      return { movementsQuery: nestedData, totalRows: movementsCount!.count };
    }

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
        if (mv.id === 10) {
        }
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

        const balanceDirection = movementBalanceDirection(
          mv.transaction.fromEntityId,
          mv.transaction.toEntityId,
          mv.direction,
        );
        const direction =
          selectedEntity.id < otherEntity.id
            ? balanceDirection
            : -balanceDirection;

        const tableData: z.infer<typeof tableDataType> = {
          id: mv.id,
          date: moment(mv.transaction.operation.date).format(
            "DD-MM-YYYY HH:mm",
          ),
          operationId: mv.transaction.operationId,
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
          balance:
            selectedEntity.id < otherEntity.id ? mv.balance : -mv.balance,
        };
        return tableData;
      });

    return { movementsQuery: nestedData, totalRows: movementsCount!.count };
  });

  return response;
};

export const settingEnum = z.enum(["accountingPeriod", "mainTag"]);

const accountingPeriodSchema = z.object({
  name: z.literal(settingEnum.enum.accountingPeriod),
  data: z.object({
    months: z.number().positive().int(),
    graceDays: z
      .number()
      .int()
      .refine((n) => n >= 0),
  }),
});

const mainTagSettingSchema = z.object({
  name: z.literal(settingEnum.enum.mainTag),
  data: z.object({
    tag: z.string(),
  }),
});

export const globalSettingSchema = z.union([
  accountingPeriodSchema,
  mainTagSettingSchema,
]);

export const getGlobalSettings = async (
  redis: Redis,
  db: PostgresJsDatabase<typeof schema>,
  setting: z.infer<typeof settingEnum>,
) => {
  const cachedResponseString = await redis.get(`globalSetting|${setting}`);

  if (cachedResponseString) {
    const cachedResponse = globalSettingSchema.safeParse(
      JSON.parse(cachedResponseString),
    );

    if (!cachedResponse.success) {
      throw new TRPCError({
        code: "PARSE_ERROR",
        message: cachedResponse.error.message,
      });
    }

    return cachedResponse.data;
  }

  const [response] = await db
    .select()
    .from(globalSettings)
    .where(eq(globalSettings.name, setting))
    .limit(1);

  if (!response) {
    if (setting === settingEnum.enum.accountingPeriod) {
      return {
        name: settingEnum.enum.accountingPeriod,
        data: { months: 1, graceDays: 10 },
      };
    }
    if (setting === settingEnum.enum.mainTag) {
      return { name: settingEnum.enum.mainTag, data: { tag: "Maika" } };
    }
  }

  const parsedResponse = globalSettingSchema.safeParse(response);

  if (!parsedResponse.success) {
    throw new TRPCError({
      code: "PARSE_ERROR",
      message: parsedResponse.error.message,
    });
  }

  await redis.set(
    `globalSetting|${setting}`,
    JSON.stringify(parsedResponse.data),
    "EX",
    7200,
  );

  return parsedResponse.data;
};

export const deletePattern = async (redis: Redis, pattern: string) => {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(keys);
  }
};
