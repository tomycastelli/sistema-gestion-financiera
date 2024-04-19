import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  gt,
  sql,
  type ExtractTablesWithRelations,
  lt,
  inArray,
  lte,
  or,
  not,
  gte,
  isNull,
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
import { type dynamodb } from "~/server/dynamodb";
import type * as schema from "../server/db/schema";
import {
  balances,
  movements,
  operations,
  role,
  transactions,
  type returnedTransactionsSchema,
  type insertMovementsSchema,
  links,
  entities,
  transactionsMetadata,
  globalSettings,
  type returnedBalancesSchema,
} from "../server/db/schema";
import { getAllChildrenTags, movementBalanceDirection } from "./functions";
import { PermissionSchema, mergePermissions } from "./permissionsTypes";
import { type createTRPCContext } from "~/server/api/trpc";
import { dateFormatting } from "./variables";

export const getAllPermissions = async (
  redis: Redis,
  user: User | null | undefined,
  db: PostgresJsDatabase<typeof schema>,
) => {
  if (!user) {
    return [];
  }

  const cachedResponseString = await redis.get(`user_permissions:${user.id}`);
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
          `user_permissions:${user.id}`,
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
        `user_permissions:${user.id}`,
        JSON.stringify(permissions),
        "EX",
        3600,
      );

      return permissions
    }
  }
  if (user?.permissions) {
    await redis.set(
      `user_permissions:${user.id}`,
      JSON.stringify(user.permissions),
      "EX",
      3600,
    );

    return user.permissions
  }
  return []
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

  await redis.set("entities", JSON.stringify(entities), "EX", 3600);

  return entities;
};

export const generateMovements = async (
  transaction: PgTransaction<
    PostgresJsQueryResultHKT,
    typeof schema,
    ExtractTablesWithRelations<typeof schema>
  >,
  tx: z.infer<typeof returnedTransactionsSchema> & {
    operation: { date: Date };
    fromEntity: { id: number; tagName: string; };
    toEntity: { id: number; tagName: string };
  },
  account: boolean,
  direction: number,
  type: string,
) => {
  const movementsResponse = []

  const changeAmount = movementBalanceDirection(tx.fromEntityId, tx.toEntityId, direction) * tx.amount

  const mvDate = tx.operation.date

  const selectedEntity = tx.fromEntityId < tx.toEntityId ? tx.fromEntity : tx.toEntity
  const otherEntity = tx.fromEntityId < tx.toEntityId ? tx.toEntity : tx.fromEntity

  // Voy a tener que hacer lo mismo tres veces, una para balance entre entidades, otras dos para entidad-tag / tag-entidad
  for (let index = 0; index < 3; index++) {
    const movementsArray: z.infer<typeof insertMovementsSchema>[] = [];

    const entitiesQuery = index === 0 ? and(
      eq(balances.selectedEntityId, selectedEntity.id),
      eq(balances.otherEntityId, otherEntity.id),
    ) : index === 1 ? and(
      eq(balances.selectedEntityId, selectedEntity.id),
      eq(balances.tagName, otherEntity.tagName)
    ) : index === 2 ? and(
      eq(balances.otherEntityId, otherEntity.id),
      eq(balances.tagName, selectedEntity.tagName)
    ) : undefined

    const balanceEntitiesToInsert = index === 0 ? { selectedEntityId: selectedEntity.id, otherEntityId: otherEntity.id }
      : index === 1 ? { selectedEntityId: selectedEntity.id, tagName: otherEntity.tagName }
        : index === 2 ? { otherEntityId: otherEntity.id, tagName: selectedEntity.tagName } : undefined

    // Busco el ultimo balance relacionado al movimiento por hacer
    const [balance] = await transaction
      .select({ id: balances.id, amount: balances.balance, date: balances.date })
      .from(balances)
      .where(
        and(
          eq(balances.account, account),
          eq(balances.currency, tx.currency),
          entitiesQuery
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
        entitiesMovementId: index !== 0 ? movementsResponse[0]!.id : null
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
              entitiesQuery
            ),
          ).returning({ id: balances.id, amount: balances.balance });

        // Busco el balance mas reciente previo al que voy a insertar
        const [beforeBalance] = await transaction
          .select({ amount: balances.balance })
          .from(balances)
          .where(
            and(
              eq(balances.account, account),
              eq(balances.currency, tx.currency),
              lt(balances.date, moment(mvDate).startOf("day").toDate()),
              entitiesQuery
            ),
          )
          .orderBy(desc(balances.date))
          .limit(1);

        if (!oldBalance) {
          // Si no existe un balance de esa fecha previa, creo uno donde el monto sea el ultimo monto previo a ese mas el cambio
          const [newBalance] = await transaction.insert(balances).values({
            account,
            currency: tx.currency,
            date: moment(mvDate).startOf("day").toDate(),
            ...balanceEntitiesToInsert!,
            balance: beforeBalance ? beforeBalance.amount + changeAmount : changeAmount
          }).returning({ id: balances.id, amount: balances.balance })

          if (newBalance) {
            // Creo un movimiento con el nuevo balance creado
            movementsArray.push({
              transactionId: tx.id,
              direction: direction,
              account: account,
              type: type,
              balance: newBalance.amount,
              balanceId: newBalance.id,
              entitiesMovementId: index !== 0 ? movementsResponse[0]!.id : null
            })
          }
        } else {
          // Busco el balance del movimiento realizado ese dia que este justo antes del que voy a insertar en cuanto a fecha
          const [movement] = await transaction.select({ amount: movements.balance }).from(movements)
            .leftJoin(transactions, eq(movements.transactionId, transactions.id))
            .leftJoin(operations, eq(transactions.operationId, operations.id))
            .where(
              and(
                eq(movements.balanceId, oldBalance.id),
                lte(operations.date, mvDate)
              )
            ).orderBy(desc(movements.id)).limit(1)

          // Creo un movimiento con el balance cambiado
          movementsArray.push({
            transactionId: tx.id,
            direction,
            account,
            type,
            balance: movement ? movement.amount + changeAmount : beforeBalance ? beforeBalance.amount + changeAmount : changeAmount,
            balanceId: oldBalance.id,
            entitiesMovementId: index !== 0 ? movementsResponse[0]!.id : null
          })
        }

        // Actualizo todos los balances posteriores a la fecha previa cambiada
        await transaction.update(balances).set({ balance: sql`${balances.balance} + ${changeAmount}` }).where(
          and(
            gt(balances.date, moment(mvDate).startOf("day").toDate()),
            eq(balances.account, account),
            eq(balances.currency, tx.currency),
            entitiesQuery
          )
        )
      } else if (moment(mvDate).isSame(balance.date, "day")) {
        // Si la fecha de la tx o op es la misma que el ultimo balance, cambio el ultimo balance
        await transaction.update(balances).set({ balance: sql`${balances.balance} + ${changeAmount}` }).where(eq(balances.id, balance.id))

        // Busco el balance del movimiento realizado ese dia que este justo antes del que voy a insertar en cuanto a fecha
        const [movement] = await transaction.select({ amount: movements.balance }).from(movements)
          .leftJoin(transactions, eq(movements.transactionId, transactions.id))
          .leftJoin(operations, eq(transactions.operationId, operations.id))
          .where(
            and(
              eq(movements.balanceId, balance.id),
              lte(operations.date, mvDate)
            )
          ).orderBy(desc(movements.id)).limit(1)

        // Creo un movimiento con el balance cambiado
        movementsArray.push({
          transactionId: tx.id,
          direction,
          account,
          type,
          balance: movement ? movement.amount + changeAmount : balance.amount + changeAmount,
          balanceId: balance.id,
          entitiesMovementId: index !== 0 ? movementsResponse[0]!.id : null
        })
      } else {
        // Si la fecha de la tx o op es posterior al ultimo balance, creo una nueva
        const [newBalance] = await transaction.insert(balances).values({ account, currency: tx.currency, ...balanceEntitiesToInsert!, date: moment(mvDate).startOf("day").toDate(), balance: balance.amount + changeAmount }).returning({ id: balances.id, amount: balances.balance })

        if (newBalance) {
          movementsArray.push({
            transactionId: tx.id,
            direction,
            account,
            type,
            balance: newBalance.amount,
            balanceId: newBalance.id,
            entitiesMovementId: index !== 0 ? movementsResponse[0]!.id : null
          })
        }
      }
    }

    // Actualizo los movimientos posteriores al que voy a insertar
    const response = await transaction.select({ id: movements.id }).from(movements)
      .leftJoin(transactions, eq(movements.transactionId, transactions.id))
      .leftJoin(operations, eq(transactions.operationId, operations.id))
      .leftJoin(balances, eq(movements.balanceId, balances.id))
      .where(
        and(
          eq(movements.account, account),
          eq(transactions.currency, tx.currency),
          entitiesQuery,
          gt(operations.date, mvDate)
        )
      )
    const movementsIds = response.length > 0 ? response.map(obj => obj.id) : [0]

    await transaction.update(movements).set({ balance: sql`${movements.balance} + ${changeAmount}` }).where(inArray(movements.id, movementsIds))

    const [createdMovement] = await transaction
      .insert(movements)
      .values(movementsArray)
      .returning();

    movementsResponse.push(createdMovement!)

  }

  return movementsResponse
};

export const undoBalances = async (
  db: PostgresJsDatabase<typeof schema>,
  txId?: number,
  opId?: number,
) => {
  const balancesArray: z.infer<typeof returnedBalancesSchema>[] = [];
  if (txId) {
    const transaction = await db.query.transactions.findFirst({
      where: eq(transactions.id, txId),
      with: {
        movements: true,
      },
      columns: {
        fromEntityId: true,
        toEntityId: true,
        amount: true,
      },
    });

    if (transaction) {
      for (const mv of transaction.movements) {
        const amountModifiedByMovement =
          movementBalanceDirection(
            transaction.fromEntityId,
            transaction.toEntityId,
            mv.direction,
          ) * transaction.amount;

        const [balance] = await db
          .update(balances)
          .set({
            balance: sql`${balances.balance} - ${amountModifiedByMovement}`,
          })
          .where(eq(balances.id, mv.balanceId))
          .returning();

        balancesArray.push(balance!);
      }
    }
  } else if (opId) {
    const operation = await db.query.operations.findFirst({
      with: {
        transactions: {
          with: {
            movements: true,
          },
        },
      },
      where: eq(operations, opId),
    });

    if (operation) {
      for (const transaction of operation.transactions) {
        for (const mv of transaction.movements) {
          const amountModifiedByMovement =
            movementBalanceDirection(
              transaction.fromEntityId,
              transaction.toEntityId,
              mv.direction,
            ) * transaction.amount;

          const [balance] = await db
            .update(balances)
            .set({
              balance: sql`${balances.balance} - ${amountModifiedByMovement}`,
            })
            .where(eq(balances.id, mv.balanceId))
            .returning();

          balancesArray.push(balance!);
        }
      }
    }
  }
  return balances;
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

const currentAccountsProcedureInput = z.object({
  linkId: z.number().int().optional().nullable(),
  linkToken: z.string().optional().nullable(),
  sharedEntityId: z.number().optional().nullish(),
  pageSize: z.number().int(),
  pageNumber: z.number().int(),
  entityId: z.number().int().optional().nullish(), // Change from array to single number
  entityTag: z.string().optional().nullish(),
  toEntityId: z.number().int().optional().nullish(),
  currency: z.string().optional().nullish(),
  account: z.boolean().optional(),
  fromDate: z.date().optional().nullish(),
  toDate: z.date().optional().nullish(),
  dayInPast: z.string().optional(),
  groupInTag: z.boolean().default(true),
})

export const currentAccountsProcedure = async (
  input: z.infer<typeof currentAccountsProcedureInput>,
  ctx: Awaited<ReturnType<typeof createTRPCContext>>) => {
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
  const fromEntityObject = alias(entities, "fromEntityObject");
  const toEntityObject = alias(entities, "toEntityObject");

  const tags = await getAllTags(ctx.redis, ctx.db)
  const tagAndChildrenResponse = getAllChildrenTags(input.entityTag, tags)
  const tagAndChildren = tagAndChildrenResponse.length > 0 ? tagAndChildrenResponse : [""]

  // Hay que hacer join con transactions para que funcionen estas conditions
  const mainConditions = and(
    input.entityId ? and(
      input.toEntityId ? or(
        and(
          eq(balances.selectedEntityId, input.toEntityId),
          eq(balances.otherEntityId, input.entityId)
        ),
        and(
          eq(balances.selectedEntityId, input.entityId),
          eq(balances.otherEntityId, input.toEntityId)
        )
      ) : or(
        eq(balances.selectedEntityId, input.entityId),
        eq(balances.otherEntityId, input.entityId)
      ),
      isNull(movements.entitiesMovementId)
    ) : undefined,
    input.entityTag ? and(
      or(
        and(
          inArray(fromEntityObject.tagName, tagAndChildren),
          input.toEntityId
            ? eq(toEntityObject.id, input.toEntityId)
            : not(inArray(toEntityObject.tagName, tagAndChildren)),
        ),
        and(
          input.toEntityId
            ? eq(fromEntityObject.id, input.toEntityId)
            : not(inArray(fromEntityObject.tagName, tagAndChildren)),
          inArray(toEntityObject.tagName, tagAndChildren),
        ),
      ),
      isNull(movements.entitiesMovementId)
    ) : undefined,
    input.currency
      ? eq(transactions.currency, input.currency)
      : undefined,
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
      ?
      and(
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
      ?
      and(
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
    const movementsIdsQuery = transaction
      .select({
        id: movements.id,
      })
      .from(movements)
      .leftJoin(transactions, eq(movements.transactionId, transactions.id))
      .leftJoin(operations, eq(transactions.operationId, operations.id))
      .leftJoin(balances, eq(movements.balanceId, balances.id))
      .leftJoin(
        fromEntityObject,
        eq(fromEntityObject.id, balances.selectedEntityId),
      )
      .leftJoin(
        toEntityObject,
        eq(toEntityObject.id, balances.otherEntityId),
      )
      .where(
        and(
          movementsConditions,
          mainConditions,
        ),
      ).prepare("movements_ids_query");

    const movementsIds = await movementsIdsQuery.execute()

    if (movementsIds.length === 0) {
      return { movementsQuery: [], totalRows: 0 }
    }

    const fromEntity = alias(entities, "fromEntity")
    const toEntity = alias(entities, "toEntity")

    const mvIds = movementsIds.map(obj => obj.id)

    const movementsQuery = transaction.select().from(movements)
      .leftJoin(transactions, eq(movements.transactionId, transactions.id))
      .leftJoin(operations, eq(transactions.operationId, operations.id))
      .leftJoin(transactionsMetadata, eq(transactions.id, transactionsMetadata.transactionId))
      .leftJoin(fromEntity, eq(transactions.fromEntityId, fromEntity.id))
      .leftJoin(toEntity, eq(transactions.toEntityId, toEntity.id))
      .leftJoin(balances, eq(movements.balanceId, balances.id))
      .where(inArray(movements.id, mvIds))
      .orderBy(desc(operations.date), desc(movements.id))
      .offset(sql.placeholder("queryOffset"))
      .limit(sql.placeholder("queryLimit")).prepare("movements_query")

    const movementsData = await movementsQuery.execute({
      queryOffset: (input.pageNumber - 1) * input.pageSize,
      queryLimit: input.pageSize
    })

    if (input.entityTag && input.groupInTag) {
      // Agarro los movimientos en su version de Tag
      const ids = movementsData.map(obj => obj.Movements.id)

      const tagBalanceMovements = await transaction.select().from(movements)
        .leftJoin(balances, eq(movements.balanceId, balances.id))
        .where(
          and(
            inArray(movements.entitiesMovementId, ids),
            eq(balances.tagName, input.entityTag),
          ))

      const nestedData = movementsData.map(obj =>
      ({
        ...obj.Movements,
        balance: tagBalanceMovements.find(mv => mv.Movements.entitiesMovementId === obj.Movements.id)?.Movements.balance ?? 0,
        transaction: { ...obj.Transactions!, transactionMetadata: obj.TransactionsMetadata!, operation: obj.Operations!, fromEntity: obj.fromEntity!, toEntity: obj.toEntity! }
      }))
      return { movementsQuery: nestedData, totalRows: movementsIds.length }
    }


    const nestedData = movementsData.map(obj =>
      ({ ...obj.Movements, transaction: { ...obj.Transactions!, transactionMetadata: obj.TransactionsMetadata!, operation: obj.Operations!, fromEntity: obj.fromEntity!, toEntity: obj.toEntity! } }))

    return { movementsQuery: nestedData, totalRows: movementsIds.length };
  });

  return response
}

export const settingEnum = z.enum(["accountingPeriod", "mainTag"])

const accountingPeriodSchema = z.object({
  name: z.literal(settingEnum.enum.accountingPeriod),
  data: z.object({
    months: z.number().positive().int(),
    graceDays: z.number().positive().int()
  })
})

const mainTagSettingSchema = z.object({
  name: z.literal(settingEnum.enum.mainTag),
  data: z.object({
    tag: z.string()
  })
})

export const globalSettingSchema = z.union([
  accountingPeriodSchema,
  mainTagSettingSchema
])


export const getGlobalSettings = async (
  ctx: Awaited<ReturnType<typeof createTRPCContext>>,
  setting: z.infer<typeof settingEnum>
) => {
  const cachedResponseString = await ctx.redis.get(`globalSetting|${setting}`)

  if (cachedResponseString) {
    const cachedResponse = globalSettingSchema.safeParse(JSON.parse(cachedResponseString))

    if (!cachedResponse.success) {
      throw new TRPCError({
        code: "PARSE_ERROR",
        message: cachedResponse.error.message
      })
    }

    return cachedResponse.data
  }

  const [response] = await ctx.db.select().from(globalSettings).where(eq(globalSettings.name, setting)).limit(1)

  if (!response) {
    if (setting === settingEnum.enum.accountingPeriod) {
      return { name: settingEnum.enum.accountingPeriod, data: { months: 1, graceDays: 10 } }
    }
    if (setting === settingEnum.enum.mainTag) {
      return { name: settingEnum.enum.mainTag, data: { tag: "Maika" } }
    }
  }

  const parsedResponse = globalSettingSchema.safeParse(response)

  if (!parsedResponse.success) {
    throw new TRPCError({
      code: "PARSE_ERROR",
      message: parsedResponse.error.message
    })
  }

  await ctx.redis.set(`globalSetting|${setting}`, JSON.stringify(parsedResponse.data), "EX", 7200)

  return parsedResponse.data

}
