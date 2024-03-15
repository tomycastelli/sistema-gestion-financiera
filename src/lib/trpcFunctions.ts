import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, or, sql } from "drizzle-orm";
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";
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
  type returnedMovementsSchema,
  type returnedTransactionsSchema,
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
          300,
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
        300,
      );

      return roleFound.permissions as z.infer<typeof PermissionSchema> | null;
    }
  }
  if (user?.permissions) {
    await redis.set(
      `user_permissions:${user.id}`,
      JSON.stringify(user.permissions),
      "EX",
      300,
    );

    return user.permissions as z.infer<typeof PermissionSchema> | null;
  }
};

export const getAllTags = async (
  redis: Redis,
  db: PostgresJsDatabase<typeof schema>,
) => {
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
  const cachedEntities: string | null = await redis.get("cached_entities");

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

  await redis.set("cached_entities", JSON.stringify(entities), "EX", "3600");

  return entities;
};

export const generateMovements = async (
  db: PostgresJsDatabase<typeof schema>,
  tx: z.infer<typeof returnedTransactionsSchema> & {
    operation: { date: Date };
  },
  account: boolean,
  direction: number,
  type: string,
) => {
  const movementsArray: Omit<z.infer<typeof returnedMovementsSchema>, "id">[] =
    [];
  const currentDate = moment().startOf("day").format("DD-MM-YYYY");

  const [balance] = await db
    .select()
    .from(balances)
    .where(
      and(
        eq(balances.account, account),
        eq(balances.currency, tx.currency),
        eq(
          balances.selectedEntityId,
          tx.fromEntityId < tx.toEntityId ? tx.fromEntityId : tx.toEntityId,
        ),
        eq(
          balances.otherEntityId,
          tx.fromEntityId < tx.toEntityId ? tx.toEntityId : tx.fromEntityId,
        ),
      ),
    )
    .orderBy(desc(balances.date))
    .limit(1);

  const insertedMovements = await db.transaction(async (transaction) => {
    if (
      tx.date
        ? moment(tx.date).isBefore(moment(currentDate, "DD-MM-YYYY"), "day")
        : moment(tx.operation.date).isBefore(
            moment(currentDate, "DD-MM-YYYY"),
            "day",
          )
    ) {
      const oldDate = tx.date
        ? moment(tx.date).startOf("day").toDate()
        : moment(tx.operation.date).startOf("day").toDate();

      // Si la operatoria es antes de hoy, busco el balance de ese dia
      const [oldBalance] = await transaction
        .select()
        .from(balances)
        .where(
          and(
            eq(balances.account, account),
            eq(balances.currency, tx.currency),
            eq(balances.date, oldDate),
            eq(
              balances.selectedEntityId,
              tx.fromEntityId < tx.toEntityId ? tx.fromEntityId : tx.toEntityId,
            ),
            eq(
              balances.otherEntityId,
              tx.fromEntityId < tx.toEntityId ? tx.toEntityId : tx.fromEntityId,
            ),
          ),
        )
        .limit(1);

      // Le cambio el monto a todos los balances posteriores
      await transaction
        .update(balances)
        .set({
          balance: sql`${balances.balance} + ${
            movementBalanceDirection(
              tx.fromEntityId,
              tx.toEntityId,
              direction,
            ) * tx.amount
          }`,
        })
        .where(
          or(
            oldBalance ? eq(balances.id, oldBalance.id) : undefined,
            and(
              eq(balances.account, account),
              eq(balances.currency, tx.currency),
              gt(balances.date, oldDate),
            ),
            and(
              eq(
                balances.selectedEntityId,
                tx.fromEntityId < tx.toEntityId
                  ? tx.fromEntityId
                  : tx.toEntityId,
              ),
              eq(
                balances.otherEntityId,
                tx.fromEntityId < tx.toEntityId
                  ? tx.toEntityId
                  : tx.fromEntityId,
              ),
            ),
          ),
        );

      // Le cambio del monto al balance de los movimientos posteriores tambien
      await transaction.update(movements).set({
        balance: sql`${movements.balance} + ${
          movementBalanceDirection(tx.fromEntityId, tx.toEntityId, direction) *
          tx.amount
        }`,
      }).where(sql`${movements.balanceId} IN (
        SELECT b.id
        FROM balances b
        WHERE ${oldBalance ? sql`b.id = ${oldBalance.id}` : sql`1=2`}
        OR (
          AND (
            b.account = ${account}
            b.currency = ${tx.currency}
            b.date > ${oldDate.toDateString()}
            ${
              tx.fromEntityId < tx.toEntityId
                ? sql`
            b.selectedEntityId = ${tx.fromEntityId}
            b.otherEntityId = ${tx.toEntityId}
            `
                : sql`
            b.selectedEntityId = ${tx.toEntityId}
            b.otherEntityId = ${tx.fromEntityId}
            `
            }
          )
        )
      )`);

      if (!oldBalance) {
        // Creo el balance para ese dia si no existe, tomando el monto del anterior y sumandole, asi justifico el gap con haber subido todos los que estan adelante

        // Busco el anterior
        const [beforeBalance2] = await transaction
          .select()
          .from(balances)
          .where(
            and(
              eq(balances.account, account),
              eq(balances.currency, tx.currency),
              eq(balances.date, oldDate),
              eq(
                balances.selectedEntityId,
                tx.fromEntityId < tx.toEntityId
                  ? tx.fromEntityId
                  : tx.toEntityId,
              ),
              eq(
                balances.otherEntityId,
                tx.fromEntityId < tx.toEntityId
                  ? tx.toEntityId
                  : tx.fromEntityId,
              ),
            ),
          )
          .orderBy(desc(balances.date))
          .limit(1);

        const [response] = await transaction
          .insert(balances)
          .values({
            selectedEntityId:
              tx.fromEntityId < tx.toEntityId ? tx.fromEntityId : tx.toEntityId,
            otherEntityId:
              tx.fromEntityId < tx.toEntityId ? tx.toEntityId : tx.fromEntityId,
            account: account,
            currency: tx.currency,
            date: tx.date
              ? moment(tx.date).startOf("day").toDate()
              : moment(tx.operation.date).startOf("day").toDate(),
            balance: beforeBalance2
              ? beforeBalance2.balance +
                movementBalanceDirection(
                  tx.fromEntityId,
                  tx.toEntityId,
                  direction,
                ) *
                  tx.amount
              : movementBalanceDirection(
                  tx.fromEntityId,
                  tx.toEntityId,
                  direction,
                ) * tx.amount,
          })
          .returning();
        movementsArray.push({
          transactionId: tx.id,
          direction,
          type,
          account,
          balance: response!.balance,
          balanceId: response!.id,
        });
      } else {
        movementsArray.push({
          transactionId: tx.id,
          direction: direction,
          type: type,
          account: account,
          balance: oldBalance.balance,
          balanceId: oldBalance.id,
        });
      }
    } else {
      if (balance) {
        if (moment(balance.date).format("DD-MM-YYYY") === currentDate) {
          const [response] = await transaction
            .update(balances)
            .set({
              balance: sql`${balances.balance} + ${
                movementBalanceDirection(
                  tx.fromEntityId,
                  tx.toEntityId,
                  direction,
                ) * tx.amount
              }`,
            })
            .where(eq(balances.id, balance.id))
            .returning();

          movementsArray.push({
            transactionId: tx.id,
            direction: direction,
            type: type,
            account: account,
            balance: response!.balance,
            balanceId: response!.id,
          });
        } else {
          const balanceNumber =
            balance.balance +
            movementBalanceDirection(
              tx.fromEntityId,
              tx.toEntityId,
              direction,
            ) *
              tx.amount;

          const [response] = await transaction
            .insert(balances)
            .values({
              selectedEntityId:
                tx.fromEntityId < tx.toEntityId
                  ? tx.fromEntityId
                  : tx.toEntityId,
              otherEntityId:
                tx.fromEntityId < tx.toEntityId
                  ? tx.toEntityId
                  : tx.fromEntityId,
              account: account,
              currency: tx.currency,
              date: moment(currentDate, "DD-MM-YYYY").toDate(),
              balance: balanceNumber,
            })
            .returning();

          movementsArray.push({
            transactionId: tx.id,
            direction: direction,
            type: type,
            account: account,
            balance: response!.balance,
            balanceId: response!.id,
          });
        }
      } else {
        const [response] = await transaction
          .insert(balances)
          .values({
            selectedEntityId:
              tx.fromEntityId < tx.toEntityId ? tx.fromEntityId : tx.toEntityId,
            otherEntityId:
              tx.fromEntityId < tx.toEntityId ? tx.toEntityId : tx.fromEntityId,
            account: account,
            currency: tx.currency,
            date: moment(currentDate, "DD-MM-YYYY").toDate(),
            balance:
              movementBalanceDirection(
                tx.fromEntityId,
                tx.toEntityId,
                direction,
              ) * tx.amount,
          })
          .returning();

        movementsArray.push({
          transactionId: tx.id,
          direction: direction,
          type: type,
          account: account,
          balance: response!.balance,
          balanceId: response!.id,
        });
      }
    }

    const createdMovements = await transaction
      .insert(movements)
      .values(movementsArray)
      .returning();

    return createdMovements;
  });

  return insertedMovements;
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
