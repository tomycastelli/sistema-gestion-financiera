import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  gt,
  or,
  sql,
  type ExtractTablesWithRelations,
  lt,
  isNotNull,
  isNull,
  inArray,
} from "drizzle-orm";
import { type PgTransaction } from "drizzle-orm/pg-core";
import {
  type PostgresJsDatabase,
  type PostgresJsQueryResultHKT,
} from "drizzle-orm/postgres-js";
import type Redis from "ioredis";
import { type User } from "lucia";
import moment from "moment";
import { ZodError, type z } from "zod";
import { type dynamodb } from "~/server/dynamodb";
import type * as schema from "../server/db/schema";
import {
  balances,
  movements,
  operations,
  role,
  transactions,
  type returnedBalancesSchema,
  type returnedTransactionsSchema,
  type insertMovementsSchema,
} from "../server/db/schema";
import { movementBalanceDirection } from "./functions";
import { PermissionSchema, mergePermissions } from "./permissionsTypes";

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
      await redis.set(
        `user_permissions:${user.id}`,
        JSON.stringify(role.permissions),
        "EX",
        3600,
      );

      return roleFound.permissions as z.infer<typeof PermissionSchema> | null;
    }
  }
  if (user?.permissions) {
    await redis.set(
      `user_permissions:${user.id}`,
      JSON.stringify(user.permissions),
      "EX",
      3600,
    );

    return user.permissions as z.infer<typeof PermissionSchema> | null;
  }
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
  },
  account: boolean,
  direction: number,
  type: string,
) => {
  const movementsArray: z.infer<typeof insertMovementsSchema>[] = [];

  const changeAmount = movementBalanceDirection(tx.fromEntityId, tx.toEntityId, direction) * tx.amount

  const mvDate = tx.date ?? tx.operation.date

  const selectedEntityId = tx.fromEntityId < tx.toEntityId ? tx.fromEntityId : tx.toEntityId
  const otherEntityId = tx.fromEntityId === selectedEntityId ? tx.toEntityId : tx.fromEntityId

  // Busco el ultimo balance relacionado al movimiento por hacer
  const [balance] = await transaction
    .select({ id: balances.id, amount: balances.balance, date: balances.date })
    .from(balances)
    .where(
      and(
        eq(balances.account, account),
        eq(balances.currency, tx.currency),
        eq(
          balances.selectedEntityId,
          selectedEntityId
        ),
        eq(
          balances.otherEntityId,
          otherEntityId,
        ),
      ),
    )
    .orderBy(desc(balances.date))
    .limit(1);

  if (!balance) {
    const [response] = await transaction
      .insert(balances)
      .values({
        selectedEntityId:
          selectedEntityId,
        otherEntityId:
          otherEntityId,
        account: account,
        currency: tx.currency,
        date: moment(mvDate).startOf("day").toDate(),
        balance: changeAmount,
      })
      .returning();

    console.log("Not balance ever, starting one completely new", response)

    movementsArray.push({
      transactionId: tx.id,
      direction,
      type,
      account,
      balance: response!.balance,
      balanceId: response!.id,
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
            eq(
              balances.selectedEntityId,
              selectedEntityId,
            ),
            eq(
              balances.otherEntityId,
              otherEntityId,
            ),
          ),
        ).returning({ id: balances.id, amount: balances.balance });

      if (!oldBalance) {
        // Si no existe un balance de esa fecha previa, creo uno donde el monto sea el ultimo monto previo a ese mas el cambio
        const [beforeBalance] = await transaction
          .select({ amount: balances.balance })
          .from(balances)
          .where(
            and(
              eq(balances.account, account),
              eq(balances.currency, tx.currency),
              lt(balances.date, moment(mvDate).startOf("day").toDate()),
              eq(
                balances.selectedEntityId,
                selectedEntityId,
              ),
              eq(
                balances.otherEntityId,
                otherEntityId,
              ),
            ),
          )
          .orderBy(desc(balances.date))
          .limit(1);

        console.log("Did't found an old balance for this previous date, so using the one before: ", beforeBalance)

        const [newBalance] = await transaction.insert(balances).values({ account, currency: tx.currency, date: moment(mvDate).startOf("day").toDate(), selectedEntityId, otherEntityId, balance: beforeBalance?.amount ? beforeBalance.amount + changeAmount : changeAmount }).returning({ id: balances.id, amount: balances.balance })

        if (newBalance) {
          console.log("Created a new balance for that previous date: ", newBalance)
          // Creo un movimiento con el nuevo balance creado
          movementsArray.push({
            transactionId: tx.id,
            direction: direction,
            account: account,
            type: type,
            balance: newBalance.amount,
            balanceId: newBalance.id
          })
        }
      } else {
        // Creo un movimiento con el balance cambiado
        movementsArray.push({
          transactionId: tx.id,
          direction,
          account,
          type,
          balance: oldBalance.amount,
          balanceId: oldBalance.id
        })
      }

      // Actualizo todos los balances posteriores a la fecha previa cambiada
      await transaction.update(balances).set({ balance: sql`${balances.balance} + ${changeAmount}` }).where(
        and(
          gt(balances.date, moment(mvDate).startOf("day").toDate()),
          eq(balances.account, account),
          eq(balances.currency, tx.currency),
          eq(
            balances.selectedEntityId,
            selectedEntityId,
          ),
          eq(
            balances.otherEntityId,
            otherEntityId,
          ),
        )
      )
    } else if (moment(mvDate).isSame(balance.date, "day")) {
      // Si la fecha de la tx o op es la misma que el ultimo balance, cambio el ultimo balance
      await transaction.update(balances).set({ balance: sql`${balances.balance} + ${changeAmount}` }).where(eq(balances.id, balance.id))

      console.log("The date already is the same as the newest balance, just updating it")

      // Creo un movimiento con el balance cambiado
      movementsArray.push({
        transactionId: tx.id,
        direction,
        account,
        type,
        balance: balance.amount + changeAmount,
        balanceId: balance.id
      })
    } else {
      // Si la fecha de la tx o op es posterior al ultimo balance, creo una nueva
      const [newBalance] = await transaction.insert(balances).values({ account, currency: tx.currency, selectedEntityId, otherEntityId, date: moment(mvDate).startOf("day").toDate(), balance: balance.amount + changeAmount }).returning({ id: balances.id, amount: balances.balance })

      if (newBalance) {
        movementsArray.push({
          transactionId: tx.id,
          direction,
          account,
          type,
          balance: newBalance.amount,
          balanceId: newBalance.id
        })
      }
    }
  }

  console.log("Los balances de los movimientos con tx o operacion con fecha mayor a este seran actualizados: ", mvDate.toDateString())
  const response = await transaction.select({ id: movements.id }).from(movements).leftJoin(transactions, eq(movements.transactionId, transactions.id)).leftJoin(operations, eq(transactions.operationId, operations.id)).leftJoin(balances, eq(movements.balanceId, balances.id)).where(
    and(
      eq(movements.account, account),
      eq(transactions.currency, tx.currency),
      eq(balances.selectedEntityId, selectedEntityId),
      eq(balances.otherEntityId, otherEntityId),
      or(
        and(
          isNotNull(transactions.date),
          gt(transactions.date, mvDate)
        ),
        and(
          isNull(transactions.date),
          gt(operations.date, mvDate)
        )
      )
    )
  )
  const movementsIds = response.length > 0 ? response.map(obj => obj.id) : [0]

  await transaction.update(movements).set({ balance: sql`${movements.balance} + ${changeAmount}` }).where(inArray(movements.id, movementsIds))

  console.log("Creare este movimiento", movementsArray)

  const createdMovements = await transaction
    .insert(movements)
    .values(movementsArray)
    .returning();

  return createdMovements;
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
