/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
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
import logtail, { safeSerialize } from "./logger";
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
  // Only log essential info for balance type 4a tracking
  logtail.info("generateMovements started", {
    transactionId: tx.id,
    amount: tx.amount,
    currency: tx.currency,
    account,
  });

  // Si es caja, quiero que sea siempre la fecha mas nueva, asi va arriba de todo
  // For account transactions, use current time; for regular transactions, use operation date
  const originalMvDate = account ? new Date() : tx.operation.date;

  // Normalize to start of day using server's LOCAL timezone (UTC-3)
  // Construct the Date at local midnight to avoid implicit UTC conversions (e.g. 03:00)
  const mvDate = new Date(
    originalMvDate.getFullYear(),
    originalMvDate.getMonth(),
    originalMvDate.getDate(),
    0,
    0,
    0,
    0,
  );

  // Removed logging for movement dates calculation

  // Determine ent_a and ent_b (ent_a is always the one with smaller ID)
  const ent_a = tx.fromEntity.id < tx.toEntity.id ? tx.fromEntity : tx.toEntity;
  const ent_b = tx.fromEntity.id < tx.toEntity.id ? tx.toEntity : tx.fromEntity;

  // Removed logging for entities determination

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

  // Only log balance type 4a amount
  logtail.info("Balance type 4a amount calculated", {
    balance4aAmount,
  });

  // Use a global lock for all balance calculations to ensure complete serialization
  const lock = await redlock.acquire([LOCK_MOVEMENTS_KEY], 180_000);

  try {
    // Removed lock acquisition logging

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

    // Only log balance type 4a processing result
    logtail.info("Balance type 4a processed", {
      balance4a_id: balance4a.id,
      balance4a_amount: balance4a.amount,
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

    // Only log movement creation with balance type 4a
    logtail.info("Movement created with balance type 4a", {
      movementId: createdMovement?.id,
      transactionId: createdMovement?.transactionId,
      balance_4a: createdMovement?.balance_4a,
      balance_4a_id: createdMovement?.balance_4a_id,
    });

    return [createdMovement];
  } finally {
    await lock.release();
    // Removed lock release logging
    // Flush logs at the end of the entire operation
    await logtail.flush();
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
  const loggingBalanceType = "balance_3a";

  // Only log for balance type 4a
  if (balanceField === loggingBalanceType) {
    logtail.info("processBalance started for balance type 4a", {
      transactionId: tx.id,
      balanceAmount,
      mvDate,
      originalMvDate,
    });
  }

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

  // Removed entities query logging

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

  // Only log balance fetch for type 4a
  if (balanceField === loggingBalanceType) {
    logtail.info("Balance and beforeBalance fetched for type 4a", {
      transactionId: tx.id,
      balance: balance
        ? { id: balance.id, amount: balance.amount, date: balance.date }
        : null,
      beforeBalance: beforeBalance ? { amount: beforeBalance.amount } : null,
    });
  }

  let balanceId: number | null = null;
  let finalAmount = 0;

  const updatedBalancesIds: number[] = [];

  const oppositeBalanceField = getOppositeBalanceField(balanceField);
  const oppositeBalanceIdField = getOppositeBalanceIdField(balanceIdField);

  // Removed opposite balance fields logging

  if (!balance) {
    // No previous balance, create a new one
    // mvDate is already normalized to local start of day from generateMovements
    if (balanceField === loggingBalanceType) {
      logtail.info("No previous balance found, creating new one for type 4a", {
        transactionId: tx.id,
      });
    }

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
      if (balanceField === loggingBalanceType) {
        logtail.info("New balance created for type 4a", {
          transactionId: tx.id,
          balanceId,
          finalAmount,
        });
      }
    }
  } else if (moment(mvDate).isBefore(moment(balance.date), "day")) {
    // Movement date is before the most recent balance
    // Check if we already have a balance for this exact day
    if (balanceField === loggingBalanceType) {
      logtail.info(
        "Movement date is before most recent balance, updating existing balance for type 4a",
        {
          transactionId: tx.id,
        },
      );
    }

    const [oldBalance] = await transaction
      .update(balances)
      .set({ amount: sql`${balances.amount} + ${balanceAmount}` })
      .where(and(entitiesQuery, eq(balances.date, mvDate)))
      .returning({ id: balances.id, amount: balances.amount });

    if (!oldBalance) {
      // No balance for this date, create a new one
      // mvDate is already normalized to local start of day from generateMovements
      if (balanceField === loggingBalanceType) {
        logtail.info("No balance for this date, creating new one for type 4a", {
          transactionId: tx.id,
        });
      }

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
      if (balanceField === loggingBalanceType) {
        logtail.info("New balance created for this date for type 4a", {
          transactionId: tx.id,
          balanceId,
          finalAmount,
        });
      }
    } else {
      // Search for the previous movement on the oldBalance day which is just before the originalMvDate
      if (balanceField === loggingBalanceType) {
        logtail.info(
          "Previous movement found on oldBalance day, updating balance for type 4a",
          {
            transactionId: tx.id,
          },
        );
      }

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

      if (previousMovement && balanceField === loggingBalanceType) {
        console.log("Previous Movement found: ", previousMovement);
      }

      // Note: previous movement amount is inferred inline below

      updatedBalancesIds.push(oldBalance.id);
      balanceId = oldBalance.id;
      // Calculate the correct balance amount for this movement
      // We need to find the balance amount at the time of this movement, not the final balance
      let correctBalanceAmount: number;

      if (previousMovement) {
        // If there's a previous movement on the same day, use its balance + this movement's amount
        if (!oppositeBalanceField) {
          correctBalanceAmount = previousMovement.balance_1 + balanceAmount;
        } else if (previousMovement[balanceIdField] === oldBalance.id) {
          correctBalanceAmount = previousMovement[balanceField] + balanceAmount;
        } else {
          correctBalanceAmount =
            previousMovement[oppositeBalanceField] + balanceAmount;
        }
      } else {
        // No previous movement on this day, use beforeBalance + this movement's amount
        correctBalanceAmount = beforeBalance
          ? beforeBalance.amount + balanceAmount
          : balanceAmount;
      }

      if (balanceField === loggingBalanceType) {
        console.log("Correct Balance Amount: ", correctBalanceAmount);
      }

      finalAmount = correctBalanceAmount;
      if (balanceField === loggingBalanceType) {
        logtail.info(
          "Balance updated based on previous movement for type 4a",
          safeSerialize({
            transactionId: tx.id,
            balanceId,
            finalAmount,
          }) as Record<string, unknown>,
        );
      }
    }

    // Update all balances after this date
    if (balanceField === loggingBalanceType) {
      logtail.info(
        "Updating balances after this date for type 4a",
        safeSerialize({
          transactionId: tx.id,
        }) as Record<string, unknown>,
      );
    }
    const updatedBalances = await transaction
      .update(balances)
      .set({ amount: sql`${balances.amount} + ${balanceAmount}` })
      .where(and(entitiesQuery, gt(balances.date, mvDate)))
      .returning({ id: balances.id });

    if (updatedBalances) {
      updatedBalancesIds.push(...updatedBalances.map((b) => b.id));
      if (balanceField === loggingBalanceType) {
        logtail.info(
          "Balances updated after this date for type 4a",
          safeSerialize({
            transactionId: tx.id,
            updatedBalancesIds,
          }) as Record<string, unknown>,
        );
      }
    }
  } else if (moment(mvDate).isSame(moment(balance.date), "day")) {
    // Movement date is same as most recent balance
    if (balanceField === loggingBalanceType) {
      logtail.info(
        "Movement date is same as most recent balance, updating existing balance for type 4a",
        safeSerialize({
          transactionId: tx.id,
        }) as Record<string, unknown>,
      );
    }

    const [updatedBalance] = await transaction
      .update(balances)
      .set({ amount: sql`${balances.amount} + ${balanceAmount}` })
      .where(eq(balances.id, balance.id))
      .returning({ id: balances.id, amount: balances.amount });

    if (updatedBalance) {
      updatedBalancesIds.push(updatedBalance.id);
      balanceId = updatedBalance.id;
      finalAmount = updatedBalance.amount;
      if (balanceField === loggingBalanceType) {
        logtail.info(
          "Balance updated for same day for type 4a",
          safeSerialize({
            transactionId: tx.id,
            balanceId,
            finalAmount,
          }) as Record<string, unknown>,
        );
      }
    }

    // Find the latest movement on this day that is before the current originalMvDate
    if (balanceField === loggingBalanceType) {
      logtail.info(
        "Finding previous movement on same day for type 4a",
        safeSerialize({
          transactionId: tx.id,
        }) as Record<string, unknown>,
      );
    }
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

    // Note: previous movement amount is inferred inline below

    balanceId = updatedBalance!.id;
    // Exists because we have a balance for this day
    // Calculate the correct balance amount for this movement
    // We need to find the balance amount at the time of this movement, not the final balance
    let correctBalanceAmount: number;

    if (previousMovement) {
      // If there's a previous movement on the same day, use its balance + this movement's amount
      if (!oppositeBalanceField) {
        correctBalanceAmount = previousMovement.balance_1 + balanceAmount;
      } else if (previousMovement[balanceIdField] === balance.id) {
        correctBalanceAmount = previousMovement[balanceField] + balanceAmount;
      } else {
        correctBalanceAmount =
          previousMovement[oppositeBalanceField] + balanceAmount;
      }
    } else {
      // No previous movement on this day, use beforeBalance + this movement's amount
      correctBalanceAmount = beforeBalance
        ? beforeBalance.amount + balanceAmount
        : balanceAmount;
    }

    finalAmount = correctBalanceAmount;
    if (balanceField === loggingBalanceType) {
      logtail.info(
        "Balance updated based on previous movement for same day for type 4a",
        safeSerialize({
          transactionId: tx.id,
          balanceId,
          finalAmount,
        }) as Record<string, unknown>,
      );
    }
  } else {
    // Movement date is after most recent balance
    // mvDate is already normalized to local start of day from generateMovements
    if (balanceField === loggingBalanceType) {
      logtail.info(
        "Movement date is after most recent balance, creating new balance for type 4a",
        {
          transactionId: tx.id,
        },
      );
    }

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
      if (balanceField === loggingBalanceType) {
        logtail.info(
          "New balance created for after most recent balance for type 4a",
          {
            transactionId: tx.id,
            balanceId,
            finalAmount,
          },
        );
      }
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
    if (balanceField === loggingBalanceType) {
      logtail.info("Updating movements for balance type 4a", {
        transactionId: tx.id,
        updatedBalancesIds,
      });
    }
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
      .prepare(`updateMovements_${balanceField}`);

    await updateMovements.execute({
      amount: balanceAmount,
      balanceIds: updatedBalancesIds,
      originalMvDate: originalMvDateString,
    });

    // If this balance type has an opposite type (2a/2b, 3a/3b, 4a/4b),
    // also update movements that reference the opposite balance ID with the same entities
    if (oppositeBalanceIdField && oppositeBalanceField) {
      if (balanceField === loggingBalanceType) {
        logtail.info("Updating opposite movements for balance type 4a", {
          transactionId: tx.id,
          oppositeBalanceField,
          updatedBalancesIds,
        });
      }
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
        .prepare(`updateOppositeMovements_${balanceField}`);

      await updateOppositeMovements.execute({
        amount: balanceAmount,
        balanceIds: updatedBalancesIds,
        originalMvDate: originalMvDateString,
      });
    }
  }

  if (balanceField === loggingBalanceType) {
    logtail.info("processBalance finished for balance type 4a", {
      transactionId: tx.id,
      balanceId,
      finalAmount,
    });
  }

  return {
    id: balanceId,
    amount: finalAmount,
  };
};
