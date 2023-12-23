import type {
  Balances,
  Movements,
  Prisma,
  PrismaClient,
  Transactions,
} from "@prisma/client";
import { type DefaultArgs } from "@prisma/client/runtime/library";
import { TRPCError } from "@trpc/server";
import type Redis from "ioredis";
import moment from "moment";
import { type Session } from "next-auth";
import { z } from "zod";
import { movementBalanceDirection } from "./functions";
import { mergePermissions, type PermissionSchema } from "./permissionsTypes";

const permissionsInput = z.object({ userId: z.string().optional() });

export const getAllPermissions = async (
  redis: Redis,
  session: Session | null,
  db: PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
  input: z.infer<typeof permissionsInput>,
) => {
  if (!session) {
    return [];
  }
  const cachedResponseString = await redis.get(
    `user_permissions:${session.user.id}`,
  );
  if (cachedResponseString) {
    const cachedResponse: z.infer<typeof PermissionSchema> =
      JSON.parse(cachedResponseString);
    return cachedResponse;
  }

  const user = await db.user.findUnique({
    where: {
      id: input.userId ? input.userId : session.user.id,
    },
  });
  if (session.user.roleId) {
    const role = await db.role.findUnique({
      where: {
        id: session.user.roleId,
      },
    });

    if (role?.permissions && user?.permissions) {
      const merged = mergePermissions(
        // @ts-ignore
        role.permissions,
        user.permissions,
      );

      await redis.set(
        `user_permissions:${session.user.id}`,
        JSON.stringify(merged),
        "EX",
        300,
      );

      return merged as z.infer<typeof PermissionSchema> | null;
    }
    if (role?.permissions) {
      await redis.set(
        `user_permissions:${session.user.id}`,
        JSON.stringify(role.permissions),
        "EX",
        300,
      );

      return role.permissions as z.infer<typeof PermissionSchema> | null;
    }
  }
  if (user?.permissions) {
    await redis.set(
      `user_permissions:${session.user.id}`,
      JSON.stringify(user.permissions),
      "EX",
      300,
    );

    return user.permissions as z.infer<typeof PermissionSchema> | null;
  }
};

export const getAllTags = async (
  redis: Redis,
  db: PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
) => {
  const cachedTagsString = await redis.get("tags");
  if (cachedTagsString) {
    const cachedTags: typeof tags = JSON.parse(cachedTagsString);
    return cachedTags;
  }

  const tags = await db.tag.findMany({
    include: {
      childTags: true,
    },
  });
  if (tags) {
    await redis.set("tags", JSON.stringify(tags), "EX", 3600);
  }
  return tags;
};

export const getAllEntities = async (
  redis: Redis,
  db: PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
) => {
  const cachedEntities: string | null = await redis.get("cached_entities");

  if (cachedEntities) {
    console.log("Entities queried from cache");
    const parsedEntities: typeof entities = JSON.parse(cachedEntities);

    return parsedEntities;
  }

  const entities = await db.entities.findMany({
    select: {
      id: true,
      name: true,
      tag: true,
    },
  });

  console.log("Entities queried from database");

  if (!entities)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Entities returned empty from database",
    });

  await redis.set("cached_entities", JSON.stringify(entities), "EX", "3600");

  return entities;
};

export const generateMovements = async (
  db: PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
  tx: Transactions,
  account: boolean,
  direction: number,
  type: string,
) => {
  const movements: Omit<Movements, "id">[] = [];
  const currentDate = moment().startOf("day").format("DD-MM-YYYY");

  const balance = await db.balances.findFirst({
    where: {
      AND: [
        { account: account, currency: tx.currency },
        tx.fromEntityId < tx.toEntityId
          ? {
              selectedEntityId: tx.fromEntityId,
              otherEntityId: tx.toEntityId,
            }
          : {
              selectedEntityId: tx.toEntityId,
              otherEntityId: tx.fromEntityId,
            },
      ],
    },
    orderBy: {
      date: "desc",
    },
  });

  const insertedMovements = await db.$transaction(async (prisma) => {
    if (balance) {
      if (moment(balance.date).format("DD-MM-YYYY") === currentDate) {
        const response = await prisma.balances.update({
          where: { id: balance.id },
          data: {
            balance: {
              increment:
                movementBalanceDirection(
                  tx.fromEntityId,
                  tx.toEntityId,
                  direction,
                ) * tx.amount,
            },
          },
        });
        movements.push({
          transactionId: tx.id,
          direction: direction,
          type: type,
          account: account,
          balance: response.balance,
          balanceId: response.id,
        });
      } else {
        const balanceNumber =
          balance.balance +
          movementBalanceDirection(tx.fromEntityId, tx.toEntityId, direction) *
            tx.amount;

        const response = await prisma.balances.create({
          data: {
            selectedEntityId:
              tx.fromEntityId < tx.toEntityId ? tx.fromEntityId : tx.toEntityId,
            otherEntityId:
              tx.fromEntityId < tx.toEntityId ? tx.toEntityId : tx.fromEntityId,
            account: account,
            currency: tx.currency,
            date: moment(currentDate, "DD-MM-YYYY").toDate(),
            balance: balanceNumber,
          },
        });
        movements.push({
          transactionId: tx.id,
          direction: direction,
          type: type,
          account: account,
          balance: response.balance,
          balanceId: response.id,
        });
      }
    } else {
      const response = await prisma.balances.create({
        data: {
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
        },
      });
      movements.push({
        transactionId: tx.id,
        direction: direction,
        type: type,
        account: account,
        balance: response.balance,
        balanceId: response.id,
      });
    }

    const createdMovements = await prisma.movements.createMany({
      data: movements,
    });

    return createdMovements;
  });

  return insertedMovements;
};

export const undoBalances = async (
  db: PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
  txId?: number,
  opId?: number,
) => {
  const balances: Balances[] = [];
  if (txId) {
    const transaction = await db.transactions.findUnique({
      where: {
        id: txId,
      },
      select: {
        movements: true,
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

        const balance = await db.balances.update({
          where: {
            id: mv.balanceId,
          },
          data: {
            balance: {
              decrement: amountModifiedByMovement,
            },
          },
        });

        balances.push(balance);
      }
    }
  } else if (opId) {
    const operation = await db.operations.findUnique({
      where: {
        id: opId,
      },
      select: {
        transactions: {
          include: {
            movements: true,
          },
        },
      },
    });

    if (operation) {
      const movements = operation.transactions.flatMap((tx) =>
        tx.movements.map((mv) => ({
          ...mv,
          txFromEntityId: tx.fromEntityId,
          txToEntityId: tx.toEntityId,
          txAmount: tx.amount,
        })),
      );

      for (const mv of movements) {
        const amountModifiedByMovement =
          movementBalanceDirection(
            mv.txFromEntityId,
            mv.txToEntityId,
            mv.direction,
          ) * mv.txAmount;

        const balance = await db.balances.update({
          where: {
            id: mv.balanceId,
          },
          data: {
            balance: {
              decrement: amountModifiedByMovement,
            },
          },
        });

        balances.push(balance);
      }
    }
  }
  return balances;
};
