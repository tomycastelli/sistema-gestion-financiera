import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  gt,
  lt,
  lte,
  or,
  sql,
  type ExtractTablesWithRelations,
} from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import moment from "moment";
import type Redlock from "redlock";
import type { z } from "zod";
import type * as schema from "../server/db/schema";
import {
  balances,
  movements,
  type returnedTransactionsSchema,
} from "../server/db/schema";
import { movementBalanceDirection } from "./functions";
import logtail from "./logger";
import { LOCK_MOVEMENTS_KEY } from "./variables";

// Helper to get the opposite balance field
export const getOppositeBalanceField = (
  field: string,
):
  | "balance_2b"
  | "balance_2a"
  | "balance_3b"
  | "balance_3a"
  | "balance_4b"
  | "balance_4a"
  | null => {
  if (field.includes("_2a")) return "balance_2b";
  if (field.includes("_2b")) return "balance_2a";
  if (field.includes("_3a")) return "balance_3b";
  if (field.includes("_3b")) return "balance_3a";
  if (field.includes("_4a")) return "balance_4b";
  if (field.includes("_4b")) return "balance_4a";
  return null; // No opposite for balance_1
};

// Helper to get opposite balance ID field
export const getOppositeBalanceIdField = (
  field: string,
):
  | "balance_2b_id"
  | "balance_2a_id"
  | "balance_3b_id"
  | "balance_3a_id"
  | "balance_4b_id"
  | "balance_4a_id"
  | null => {
  if (field.includes("_2a_id")) return "balance_2b_id";
  if (field.includes("_2b_id")) return "balance_2a_id";
  if (field.includes("_3a_id")) return "balance_3b_id";
  if (field.includes("_3b_id")) return "balance_3a_id";
  if (field.includes("_4a_id")) return "balance_4b_id";
  if (field.includes("_4b_id")) return "balance_4a_id";
  return null; // No opposite for balance_1
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
  redlock: Redlock,
) => {
  logtail.info("generateMovements started", {
    transactionId: tx.id,
    fromEntityId: tx.fromEntity.id,
    toEntityId: tx.toEntity.id,
    amount: tx.amount,
    currency: tx.currency,
    account,
    direction,
    type,
  });

  // Si es caja, quiero que sea siempre la fecha mas nueva, asi va arriba de todo
  // For account transactions, use current time; for regular transactions, use operation date
  const originalMvDate = account ? new Date() : tx.operation.date;

  // Normalize to start of day in local timezone for balance date consistency
  // This ensures all balances for the same day have the same date regardless of time
  // Use a consistent timezone (UTC) to avoid GMT-3 issues
  const mvDate = moment(originalMvDate).utc().startOf("day").toDate();

  logtail.info("Movement dates calculated", {
    originalMvDate: originalMvDate.toISOString(),
    mvDate: mvDate.toISOString(),
    account,
  });

  // Determine ent_a and ent_b (ent_a is always the one with smaller ID)
  const ent_a = tx.fromEntity.id < tx.toEntity.id ? tx.fromEntity : tx.toEntity;
  const ent_b = tx.fromEntity.id < tx.toEntity.id ? tx.toEntity : tx.fromEntity;

  logtail.info("Entities determined", {
    ent_a_id: ent_a.id,
    ent_a_tagName: ent_a.tagName,
    ent_b_id: ent_b.id,
    ent_b_tagName: ent_b.tagName,
  });

  // Calculate balance amounts for different types
  // Type 1: Entity to Entity (from perspective of ent_a)
  const balance1Amount =
    movementBalanceDirection(tx.fromEntity.id, tx.toEntity.id, direction) *
    tx.amount;

  // Type 2: Entity to Rest
  const balance2aAmount =
    tx.fromEntity.id === ent_a.id
      ? -tx.amount * direction
      : tx.amount * direction;
  const balance2bAmount =
    tx.toEntity.id === ent_b.id
      ? tx.amount * direction
      : -tx.amount * direction;

  // Type 3: Tag to Entity
  const balance3aAmount =
    tx.fromEntity.tagName === tx.toEntity.tagName
      ? 0
      : tx.fromEntity.id === ent_a.id
      ? -tx.amount * direction
      : tx.amount * direction;
  const balance3bAmount =
    tx.fromEntity.tagName === tx.toEntity.tagName
      ? 0
      : tx.toEntity.id === ent_b.id
      ? tx.amount * direction
      : -tx.amount * direction;

  // Type 4: Tag to Rest
  const balance4aAmount =
    tx.fromEntity.tagName === tx.toEntity.tagName
      ? 0
      : tx.fromEntity.tagName === ent_a.tagName
      ? -tx.amount * direction
      : tx.amount * direction;
  const balance4bAmount =
    tx.fromEntity.tagName === tx.toEntity.tagName
      ? 0
      : tx.toEntity.tagName === ent_b.tagName
      ? tx.amount * direction
      : -tx.amount * direction;

  logtail.info("Balance amounts calculated", {
    balance1Amount,
    balance2aAmount,
    balance2bAmount,
    balance3aAmount,
    balance3bAmount,
    balance4aAmount,
    balance4bAmount,
  });

  // Use a global lock for all balance calculations to ensure complete serialization
  const lock = await redlock.acquire([LOCK_MOVEMENTS_KEY], 30_000);

  try {
    logtail.info("Lock acquired, processing balances");

    // Process all balances sequentially to ensure consistency
    const balance1 = await processBalance(
      transaction,
      tx,
      mvDate,
      originalMvDate,
      account,
      balance1Amount,
      { type: "1", ent_a: ent_a.id, ent_b: ent_b.id },
      "balance_1",
      "balance_1_id",
    );

    const balance2a = await processBalance(
      transaction,
      tx,
      mvDate,
      originalMvDate,
      account,
      balance2aAmount,
      { type: "2", ent_a: ent_a.id },
      "balance_2a",
      "balance_2a_id",
    );

    const balance2b = await processBalance(
      transaction,
      tx,
      mvDate,
      originalMvDate,
      account,
      balance2bAmount,
      { type: "2", ent_a: ent_b.id },
      "balance_2b",
      "balance_2b_id",
    );

    const balance3a = await processBalance(
      transaction,
      tx,
      mvDate,
      originalMvDate,
      account,
      balance3aAmount,
      { type: "3", tag: ent_a.tagName, ent_a: ent_b.id },
      "balance_3a",
      "balance_3a_id",
    );

    const balance3b = await processBalance(
      transaction,
      tx,
      mvDate,
      originalMvDate,
      account,
      balance3bAmount,
      { type: "3", tag: ent_b.tagName, ent_a: ent_a.id },
      "balance_3b",
      "balance_3b_id",
    );

    const balance4a = await processBalance(
      transaction,
      tx,
      mvDate,
      originalMvDate,
      account,
      balance4aAmount,
      { type: "4", tag: ent_a.tagName },
      "balance_4a",
      "balance_4a_id",
    );

    // Handle the case where ent_a and ent_b have the same tag
    let balance4b;
    if (ent_a.tagName === ent_b.tagName) {
      // If same tag, balance4b will be the same as balance4a
      balance4b = { amount: balance4a.amount, id: balance4a.id };
    } else {
      balance4b = await processBalance(
        transaction,
        tx,
        mvDate,
        originalMvDate,
        account,
        balance4bAmount,
        { type: "4", tag: ent_b.tagName },
        "balance_4b",
        "balance_4b_id",
      );
    }

    logtail.info("All balances processed", {
      balance1_id: balance1.id,
      balance1_amount: balance1.amount,
      balance2a_id: balance2a.id,
      balance2a_amount: balance2a.amount,
      balance2b_id: balance2b.id,
      balance2b_amount: balance2b.amount,
      balance3a_id: balance3a.id,
      balance3a_amount: balance3a.amount,
      balance3b_id: balance3b.id,
      balance3b_amount: balance3b.amount,
      balance4a_id: balance4a.id,
      balance4a_amount: balance4a.amount,
      balance4b_id: balance4b.id,
      balance4b_amount: balance4b.amount,
    });

    // Create the movement with all the balance values
    const [createdMovement] = await transaction
      .insert(movements)
      .values({
        transactionId: tx.id,
        date: originalMvDate, // Use originalMvDate for movement ordering
        direction,
        type,
        account,
        balance_1: balance1.amount,
        balance_1_id: balance1.id,
        balance_2a: balance2a.amount,
        balance_2a_id: balance2a.id,
        balance_2b: balance2b.amount,
        balance_2b_id: balance2b.id,
        balance_3a: balance3a.amount,
        balance_3a_id: balance3a.id,
        balance_3b: balance3b.amount,
        balance_3b_id: balance3b.id,
        balance_4a: balance4a.amount,
        balance_4a_id: balance4a.id,
        balance_4b: balance4b.amount,
        balance_4b_id: balance4b.id,
      })
      .returning();

    logtail.info("Movement created", {
      movementId: createdMovement?.id,
      transactionId: createdMovement?.transactionId,
      date: createdMovement?.date.toISOString(),
      balance_1: createdMovement?.balance_1,
      balance_1_id: createdMovement?.balance_1_id,
      balance_2a: createdMovement?.balance_2a,
      balance_2a_id: createdMovement?.balance_2a_id,
      balance_2b: createdMovement?.balance_2b,
      balance_2b_id: createdMovement?.balance_2b_id,
      balance_3a: createdMovement?.balance_3a,
      balance_3a_id: createdMovement?.balance_3a_id,
      balance_3b: createdMovement?.balance_3b,
      balance_3b_id: createdMovement?.balance_3b_id,
      balance_4a: createdMovement?.balance_4a,
      balance_4a_id: createdMovement?.balance_4a_id,
      balance_4b: createdMovement?.balance_4b,
      balance_4b_id: createdMovement?.balance_4b_id,
    });

    return [createdMovement];
  } finally {
    await lock.release();
    logtail.info("Lock released");
  }
};

// Helper function to process each balance type
const processBalance = async (
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
  mvDate: Date,
  originalMvDate: Date,
  account: boolean,
  balanceAmount: number,
  balanceSettings: {
    type: "1" | "2" | "3" | "4";
    ent_a?: number;
    ent_b?: number;
    tag?: string;
  },
  balanceField:
    | "balance_1"
    | "balance_2a"
    | "balance_2b"
    | "balance_3a"
    | "balance_3b"
    | "balance_4a"
    | "balance_4b",
  balanceIdField:
    | "balance_1_id"
    | "balance_2a_id"
    | "balance_2b_id"
    | "balance_3a_id"
    | "balance_3b_id"
    | "balance_4a_id"
    | "balance_4b_id",
) => {
  logtail.info("processBalance started", {
    transactionId: tx.id,
    balanceField,
    balanceIdField,
    balanceSettings,
    account,
    originalMvDate: originalMvDate.toISOString(),
    mvDate: mvDate.toISOString(),
    balanceAmount,
  });

  // Construct query condition based on provided entities and type
  const entitiesQuery = and(
    eq(balances.type, balanceSettings.type),
    eq(balances.currency, tx.currency),
    eq(balances.account, account),
    balanceSettings.ent_a
      ? eq(balances.ent_a, balanceSettings.ent_a)
      : undefined,
    balanceSettings.ent_b
      ? eq(balances.ent_b, balanceSettings.ent_b)
      : undefined,
    balanceSettings.tag ? eq(balances.tag, balanceSettings.tag) : undefined,
  );

  logtail.info("Entities query constructed", {
    transactionId: tx.id,
    entitiesQuery,
  });

  // Fetch balance and beforeBalance concurrently
  const [balanceResult, beforeBalanceResult] = await Promise.all([
    // Find the most recent balance for this entity combination
    transaction
      .select({
        id: balances.id,
        amount: balances.amount,
        date: balances.date,
      })
      .from(balances)
      .where(entitiesQuery)
      .orderBy(desc(balances.date))
      .limit(1),

    // Find the most recent balance before the movement date
    transaction
      .select({ amount: balances.amount })
      .from(balances)
      .where(and(entitiesQuery, lt(balances.date, mvDate)))
      .orderBy(desc(balances.date))
      .limit(1),
  ]);

  const [balance] = balanceResult;
  const [beforeBalance] = beforeBalanceResult;

  logtail.info("Balance and beforeBalance fetched", {
    transactionId: tx.id,
    balance: balance
      ? { id: balance.id, amount: balance.amount, date: balance.date }
      : null,
    beforeBalance: beforeBalance ? { amount: beforeBalance.amount } : null,
  });

  let balanceId: number | null = null;
  let finalAmount = 0;

  const updatedBalancesIds: number[] = [];

  const oppositeBalanceField = getOppositeBalanceField(balanceField);
  const oppositeBalanceIdField = getOppositeBalanceIdField(balanceIdField);

  logtail.info("Opposite balance fields determined", {
    transactionId: tx.id,
    balanceField,
    oppositeBalanceField,
    balanceIdField,
    oppositeBalanceIdField,
  });

  if (!balance) {
    // No previous balance, create a new one
    // mvDate is already normalized to UTC start of day from generateMovements
    logtail.info("No previous balance found, creating new one", {
      transactionId: tx.id,
    });

    const [newBalance] = await transaction
      .insert(balances)
      .values({
        ...balanceSettings,
        account,
        currency: tx.currency,
        date: mvDate,
        amount: balanceAmount,
      })
      .returning();

    if (newBalance) {
      balanceId = newBalance.id;
      finalAmount = newBalance.amount;
      logtail.info("New balance created", {
        transactionId: tx.id,
        balanceId,
        finalAmount,
      });
    }
  } else if (moment(mvDate).utc().isBefore(moment(balance.date).utc(), "day")) {
    // Movement date is before the most recent balance
    // Check if we already have a balance for this exact day
    logtail.info(
      "Movement date is before most recent balance, updating existing balance",
      {
        transactionId: tx.id,
      },
    );

    const [oldBalance] = await transaction
      .update(balances)
      .set({ amount: sql`${balances.amount} + ${balanceAmount}` })
      .where(and(entitiesQuery, eq(balances.date, mvDate)))
      .returning({ id: balances.id, amount: balances.amount });

    if (!oldBalance) {
      // No balance for this date, create a new one
      // mvDate is already normalized to UTC start of day from generateMovements
      logtail.info("No balance for this date, creating new one", {
        transactionId: tx.id,
      });

      const [newBalance] = await transaction
        .insert(balances)
        .values({
          ...balanceSettings,
          account,
          currency: tx.currency,
          date: mvDate,
          amount: beforeBalance
            ? beforeBalance.amount + balanceAmount
            : balanceAmount,
        })
        .returning({ id: balances.id, amount: balances.amount });

      balanceId = newBalance!.id;
      finalAmount = newBalance!.amount;
      logtail.info("New balance created for this date", {
        transactionId: tx.id,
        balanceId,
        finalAmount,
      });
    } else {
      // Search for the previous movement on the oldBalance day which is just before the originalMvDate
      logtail.info(
        "Previous movement found on oldBalance day, updating balance",
        {
          transactionId: tx.id,
        },
      );

      const [previousMovement] = await transaction
        .select()
        .from(movements)
        .where(
          and(
            oppositeBalanceIdField
              ? or(
                  eq(movements[oppositeBalanceIdField], oldBalance.id),
                  eq(movements[balanceIdField], oldBalance.id),
                )
              : eq(movements[balanceIdField], oldBalance.id),
            eq(movements.account, account),
            lte(movements.date, originalMvDate),
          ),
        )
        .orderBy(desc(movements.date), desc(movements.id))
        .limit(1);

      // Determine the amount of the previous movement we are interested in
      let previousMovementAmount: number | null = null;
      if (previousMovement) {
        if (!oppositeBalanceField) {
          previousMovementAmount = previousMovement.balance_1;
        } else if (previousMovement[balanceIdField] === oldBalance.id) {
          previousMovementAmount = previousMovement[balanceField];
        } else {
          previousMovementAmount = previousMovement[oppositeBalanceField];
        }
      }

      updatedBalancesIds.push(oldBalance.id);
      balanceId = oldBalance.id;
      finalAmount =
        previousMovementAmount !== null && previousMovementAmount !== undefined
          ? previousMovementAmount + balanceAmount
          : beforeBalance
          ? beforeBalance.amount + balanceAmount
          : balanceAmount;
      logtail.info("Balance updated based on previous movement", {
        transactionId: tx.id,
        balanceId,
        finalAmount,
      });
    }

    // Update all balances after this date
    logtail.info("Updating balances after this date", {
      transactionId: tx.id,
    });
    const updatedBalances = await transaction
      .update(balances)
      .set({ amount: sql`${balances.amount} + ${balanceAmount}` })
      .where(and(entitiesQuery, gt(balances.date, mvDate)))
      .returning({ id: balances.id });

    if (updatedBalances) {
      updatedBalancesIds.push(...updatedBalances.map((b) => b.id));
      logtail.info("Balances updated after this date", {
        transactionId: tx.id,
        updatedBalancesIds,
      });
    }
  } else if (moment(mvDate).utc().isSame(moment(balance.date).utc(), "day")) {
    // Movement date is same as most recent balance
    logtail.info(
      "Movement date is same as most recent balance, updating existing balance",
      {
        transactionId: tx.id,
      },
    );

    const [updatedBalance] = await transaction
      .update(balances)
      .set({ amount: sql`${balances.amount} + ${balanceAmount}` })
      .where(eq(balances.id, balance.id))
      .returning({ id: balances.id, amount: balances.amount });

    if (updatedBalance) {
      updatedBalancesIds.push(updatedBalance.id);
      balanceId = updatedBalance.id;
      finalAmount = updatedBalance.amount;
      logtail.info("Balance updated for same day", {
        transactionId: tx.id,
        balanceId,
        finalAmount,
      });
    }

    // Find the latest movement on this day that is before the current originalMvDate
    logtail.info("Finding previous movement on same day", {
      transactionId: tx.id,
    });
    const [previousMovement] = await transaction
      .select()
      .from(movements)
      .where(
        and(
          oppositeBalanceIdField
            ? or(
                eq(movements[oppositeBalanceIdField], balance.id),
                eq(movements[balanceIdField], balance.id),
              )
            : eq(movements[balanceIdField], balance.id),
          lte(movements.date, originalMvDate),
          eq(movements.account, account),
        ),
      )
      .orderBy(desc(movements.date), desc(movements.id))
      .limit(1);

    let previousMovementAmount: number | null = null;
    if (previousMovement) {
      if (!oppositeBalanceField) {
        previousMovementAmount = previousMovement.balance_1;
      } else if (previousMovement[balanceIdField] === balance.id) {
        previousMovementAmount = previousMovement[balanceField];
      } else {
        previousMovementAmount = previousMovement[oppositeBalanceField];
      }
    }

    balanceId = updatedBalance!.id;
    // Exists because we have a balance for this day
    finalAmount =
      previousMovementAmount !== null && previousMovementAmount !== undefined
        ? previousMovementAmount + balanceAmount
        : beforeBalance
        ? beforeBalance.amount + balanceAmount
        : balanceAmount;
    logtail.info("Balance updated based on previous movement for same day", {
      transactionId: tx.id,
      balanceId,
      finalAmount,
    });
  } else {
    // Movement date is after most recent balance
    // mvDate is already normalized to UTC start of day from generateMovements
    logtail.info(
      "Movement date is after most recent balance, creating new balance",
      {
        transactionId: tx.id,
      },
    );

    const [newBalance] = await transaction
      .insert(balances)
      .values({
        ...balanceSettings,
        account,
        currency: tx.currency,
        date: mvDate,
        amount: balance.amount + balanceAmount,
      })
      .returning({ id: balances.id, amount: balances.amount });

    if (newBalance) {
      balanceId = newBalance.id;
      finalAmount = newBalance.amount;
      logtail.info("New balance created for after most recent balance", {
        transactionId: tx.id,
        balanceId,
        finalAmount,
      });
    }
  }

  // Enforce that balance ID must exist
  if (balanceId === null) {
    logtail.error("Balance ID is null after all checks", {
      transactionId: tx.id,
      balanceField,
      balanceSettings,
      account,
      mvDate,
      balanceAmount,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to create or retrieve balance ID for ${balanceField}`,
    });
  }

  // Update all movements whose balance was updated in a single query
  if (updatedBalancesIds.length > 0) {
    logtail.info("Updating movements for balance type", {
      transactionId: tx.id,
      balanceField,
      updatedBalancesIds,
    });
    const originalMvDateString = originalMvDate.toISOString();
    const updateMovements = transaction
      .update(movements)
      .set({
        [balanceField]: sql`${movements[balanceField]} + ${sql.placeholder(
          "amount",
        )}`,
      })
      .where(
        and(
          sql`${movements[balanceIdField]} = ANY(${sql.placeholder(
            "balanceIds",
          )})`,
          gt(movements.date, sql.placeholder("originalMvDate")),
        ),
      )
      .prepare("updateMovements");

    await updateMovements.execute({
      amount: balanceAmount,
      balanceIds: updatedBalancesIds,
      originalMvDate: originalMvDateString,
    });

    // If this balance type has an opposite type (2a/2b, 3a/3b, 4a/4b),
    // also update movements that reference the opposite balance ID with the same entities
    if (oppositeBalanceIdField && oppositeBalanceField) {
      logtail.info("Updating opposite movements for balance type", {
        transactionId: tx.id,
        balanceField,
        oppositeBalanceField,
        updatedBalancesIds,
      });
      const updateOppositeMovements = transaction
        .update(movements)
        .set({
          [oppositeBalanceField]: sql`${
            movements[oppositeBalanceField]
          } + ${sql.placeholder("amount")}`,
        })
        .where(
          and(
            sql`${movements[oppositeBalanceIdField]} = ANY(${sql.placeholder(
              "balanceIds",
            )})`,
            gt(movements.date, sql.placeholder("originalMvDate")),
          ),
        )
        .prepare("updateOppositeMovements");

      await updateOppositeMovements.execute({
        amount: balanceAmount,
        balanceIds: updatedBalancesIds,
        originalMvDate: originalMvDateString,
      });
    }
  }

  logtail.info("processBalance finished", {
    transactionId: tx.id,
    balanceField,
    balanceId,
    finalAmount,
  });

  return {
    id: balanceId,
    amount: finalAmount,
  };
};
