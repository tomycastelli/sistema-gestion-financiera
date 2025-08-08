/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { TRPCError } from "@trpc/server";
import {
  and,
  eq,
  gt,
  inArray,
  or,
  sql,
  type ExtractTablesWithRelations,
} from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import moment from "moment";
import type Redlock from "redlock";
import type * as schema from "../server/db/schema";
import { balances, movements } from "../server/db/schema";
import { movementBalanceDirection } from "./functions";
import {
  getOppositeBalanceField,
  getOppositeBalanceIdField,
} from "./generateMovements";
import logtail, { safeSerialize } from "./logger";
import { LOCK_MOVEMENTS_KEY } from "./variables";

export const undoMovements = async (
  transaction: PgTransaction<
    PostgresJsQueryResultHKT,
    typeof schema,
    ExtractTablesWithRelations<typeof schema>
  >,
  tx: {
    id: number;
    fromEntity: { id: number; tagName: string };
    toEntity: { id: number; tagName: string };
    amount: number;
    currency: string;
  },
  redlock: Redlock,
) => {
  // Only log essential info for balance type 4a tracking
  logtail.info("undoMovements started", {
    transactionId: tx.id,
    amount: tx.amount,
    currency: tx.currency,
  });

  // Use a global lock for all balance calculations to ensure complete serialization
  const lock = await redlock.acquire([LOCK_MOVEMENTS_KEY], 180_000);

  try {
    // Delete the movement
    // Removed logging for movement deletion
    const deletedMovements = await transaction
      .delete(movements)
      .where(eq(movements.transactionId, tx.id))
      .returning();

    // Removed logging for movements deleted

    // Determine ent_a and ent_b (ent_a is always the one with smaller ID)
    const ent_a =
      tx.fromEntity.id < tx.toEntity.id ? tx.fromEntity : tx.toEntity;
    const ent_b =
      tx.fromEntity.id < tx.toEntity.id ? tx.toEntity : tx.fromEntity;

    // Removed logging for entity order determination

    for (const movement of deletedMovements) {
      // Removed logging for processing deleted movement

      // Normalize movement date to LOCAL start of day for consistency
      const normalizedMvDate = moment(movement.date).startOf("day").toDate();

      // Removed logging for movement date normalization

      // Calculate balance amounts for different types
      // Type 1: Entity to Entity (from perspective of ent_a)
      const balance1Amount =
        movementBalanceDirection(
          tx.fromEntity.id,
          tx.toEntity.id,
          movement.direction,
        ) * tx.amount;

      // Type 2: Entity to Rest - one for each entity
      const balance2aAmount =
        tx.fromEntity.id === ent_a.id
          ? -tx.amount * movement.direction
          : tx.amount * movement.direction;
      const balance2bAmount =
        tx.toEntity.id === ent_b.id
          ? tx.amount * movement.direction
          : -tx.amount * movement.direction;

      // Type 3: Tag to Entity
      const balance3aAmount =
        tx.fromEntity.tagName === tx.toEntity.tagName
          ? 0
          : tx.fromEntity.id === ent_a.id
          ? -tx.amount * movement.direction
          : tx.amount * movement.direction;
      const balance3bAmount =
        tx.fromEntity.tagName === tx.toEntity.tagName
          ? 0
          : tx.toEntity.id === ent_b.id
          ? tx.amount * movement.direction
          : -tx.amount * movement.direction;

      // Type 4: Tag to Rest - one for each tag
      const balance4aAmount =
        tx.fromEntity.tagName === tx.toEntity.tagName
          ? 0
          : tx.fromEntity.tagName === ent_a.tagName
          ? -tx.amount * movement.direction
          : tx.amount * movement.direction;
      const balance4bAmount =
        tx.fromEntity.tagName === tx.toEntity.tagName
          ? 0
          : tx.toEntity.tagName === ent_b.tagName
          ? tx.amount * movement.direction
          : -tx.amount * movement.direction;

      // Only log balance type 4a amount
      logtail.info(
        "Balance type 4a amount calculated",
        safeSerialize({
          transactionId: tx.id,
          movementId: movement.id,
          balance4aAmount,
        }) as Record<string, unknown>,
      );

      // Process all balances sequentially to ensure consistency
      // Removed logging for balance types 1, 2a, 2b, 3a, 3b
      await processBalance(
        transaction,
        tx.id,
        movement.balance_1_id,
        balance1Amount,
        normalizedMvDate,
        movement.date,
        "balance_1",
        "balance_1_id",
        movement.id,
      );

      await processBalance(
        transaction,
        tx.id,
        movement.balance_2a_id,
        balance2aAmount,
        normalizedMvDate,
        movement.date,
        "balance_2a",
        "balance_2a_id",
        movement.id,
      );

      await processBalance(
        transaction,
        tx.id,
        movement.balance_2b_id,
        balance2bAmount,
        normalizedMvDate,
        movement.date,
        "balance_2b",
        "balance_2b_id",
        movement.id,
      );

      await processBalance(
        transaction,
        tx.id,
        movement.balance_3a_id,
        balance3aAmount,
        normalizedMvDate,
        movement.date,
        "balance_3a",
        "balance_3a_id",
        movement.id,
      );

      await processBalance(
        transaction,
        tx.id,
        movement.balance_3b_id,
        balance3bAmount,
        normalizedMvDate,
        movement.date,
        "balance_3b",
        "balance_3b_id",
        movement.id,
      );

      // Only log for balance type 4a
      logtail.info(
        "Processing balance type 4a",
        safeSerialize({
          transactionId: tx.id,
          movementId: movement.id,
          balanceId: movement.balance_4a_id,
          amount: balance4aAmount,
        }) as Record<string, unknown>,
      );
      await processBalance(
        transaction,
        tx.id,
        movement.balance_4a_id,
        balance4aAmount,
        normalizedMvDate,
        movement.date,
        "balance_4a",
        "balance_4a_id",
        movement.id,
      );

      // Process 4b only if entities have different tags
      if (tx.fromEntity.tagName !== tx.toEntity.tagName) {
        // Removed logging for balance type 4b processing
        await processBalance(
          transaction,
          tx.id,
          movement.balance_4b_id,
          balance4bAmount,
          normalizedMvDate,
          movement.date,
          "balance_4b",
          "balance_4b_id",
          movement.id,
        );
      } else {
        // Removed logging for skipping balance type 4b
      }
    }

    // Removed logging for undoMovements completion

    return deletedMovements;
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
  transactionId: number,
  balanceId: number,
  balanceAmount: number,
  normalizedMvDate: Date,
  originalMvDate: Date,
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
  movementId: number,
) => {
  // Guard: legacy/invalid movements might reference non-existent balance ids
  if (balanceId == null || balanceId <= 0) {
    if (balanceField === "balance_4a") {
      logtail.info(
        "Skipping processBalance due to invalid balanceId for type 4a",
        safeSerialize({
          transactionId,
          movementId,
          balanceId,
        }) as Record<string, unknown>,
      );
    }
    return;
  }
  // Only log for balance type 4a
  if (balanceField === "balance_4a") {
    logtail.info(
      "processBalance started for balance type 4a",
      safeSerialize({
        transactionId,
        balanceId,
        balanceAmount,
        normalizedMvDate: normalizedMvDate.toISOString(),
        originalMvDate: originalMvDate.toISOString(),
        movementId,
      }) as Record<string, unknown>,
    );
  }

  const oppositeBalanceField = getOppositeBalanceField(balanceField);
  const oppositeBalanceIdField = getOppositeBalanceIdField(balanceIdField);

  // Removed logging for opposite balance fields determination

  // Get the balance to be updated
  // Removed logging for fetching balance details
  const [balance] = await transaction
    .select({
      id: balances.id,
      amount: balances.amount,
      date: balances.date,
      type: balances.type,
      currency: balances.currency,
      account: balances.account,
      ent_a: balances.ent_a,
      ent_b: balances.ent_b,
      tag: balances.tag,
    })
    .from(balances)
    .where(eq(balances.id, balanceId))
    .limit(1);

  if (!balance) {
    logtail.error(
      "Balance not found",
      safeSerialize({
        transactionId,
        balanceId,
      }) as Record<string, unknown>,
    );
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Balance with ID ${balanceId} not found`,
    });
  }

  // Only log balance details for type 4a
  if (balanceField === "balance_4a") {
    logtail.info(
      "Balance details fetched for type 4a",
      safeSerialize({
        transactionId,
        balanceId,
        balanceAmount: balance.amount,
        balanceDate: balance.date.toISOString(),
        balanceType: balance.type,
        balanceCurrency: balance.currency,
        balanceAccount: balance.account,
        balanceEntA: balance.ent_a,
        balanceEntB: balance.ent_b,
        balanceTag: balance.tag,
      }) as Record<string, unknown>,
    );
  }

  // Construct query condition for future balances
  // normalizedMvDate is normalized to local start of day from the calling function
  const futureBalancesQuery = and(
    eq(balances.type, balance.type),
    eq(balances.currency, balance.currency),
    eq(balances.account, balance.account),
    balance.ent_a ? eq(balances.ent_a, balance.ent_a) : undefined,
    balance.ent_b ? eq(balances.ent_b, balance.ent_b) : undefined,
    balance.tag ? eq(balances.tag, balance.tag) : undefined,
    gt(balances.date, normalizedMvDate),
  );

  // Removed logging for future balances query construction

  // Update the current balance
  if (balanceField === "balance_4a") {
    logtail.info(
      "Updating current balance for type 4a",
      safeSerialize({
        transactionId,
        balanceId,
        currentAmount: balance.amount,
        amountToSubtract: balanceAmount,
        newAmount: balance.amount - balanceAmount,
      }) as Record<string, unknown>,
    );
  }
  await transaction
    .update(balances)
    .set({ amount: sql`${balances.amount} - ${balanceAmount}` })
    .where(eq(balances.id, balanceId));

  // Update all future balances
  if (balanceField === "balance_4a") {
    logtail.info(
      "Updating future balances for type 4a",
      safeSerialize({
        transactionId,
        balanceId,
      }) as Record<string, unknown>,
    );
  }
  const updatedBalances = await transaction
    .update(balances)
    .set({ amount: sql`${balances.amount} - ${balanceAmount}` })
    .where(futureBalancesQuery)
    .returning({ id: balances.id });

  if (balanceField === "balance_4a") {
    logtail.info(
      "Future balances updated for type 4a",
      safeSerialize({
        transactionId,
        balanceId,
        updatedBalancesCount: updatedBalances.length,
        updatedBalanceIds: updatedBalances.map((b) => b.id),
      }) as Record<string, unknown>,
    );
  }

  const allBalances = [...updatedBalances.map((b) => b.id), balanceId];

  // Removed logging for all affected balances

  // Update all movements related to these balances which come after the deleted balance
  if (balanceField === "balance_4a") {
    logtail.info(
      "Updating movements for balance type 4a",
      safeSerialize({
        transactionId,
        balanceId,
        allBalances,
        originalMvDate: originalMvDate.toISOString(),
        movementId,
      }) as Record<string, unknown>,
    );
  }
  await transaction
    .update(movements)
    .set({
      [balanceField]: sql`${movements[balanceField]} - ${balanceAmount}`,
    })
    .where(
      and(
        inArray(movements[balanceIdField], allBalances),
        or(
          gt(movements.date, originalMvDate),
          and(eq(movements.date, originalMvDate), gt(movements.id, movementId)),
        ),
      ),
    );

  if (oppositeBalanceField && oppositeBalanceIdField) {
    if (balanceField === "balance_4a") {
      logtail.info(
        "Updating opposite movements for balance type 4a",
        safeSerialize({
          transactionId,
          balanceId,
          oppositeBalanceField,
          allBalances,
        }) as Record<string, unknown>,
      );
    }
    await transaction
      .update(movements)
      .set({
        [oppositeBalanceField]: sql`${movements[oppositeBalanceField]} - ${balanceAmount}`,
      })
      .where(
        and(
          inArray(movements[oppositeBalanceIdField], allBalances),
          or(
            gt(movements.date, originalMvDate),
            and(
              eq(movements.date, originalMvDate),
              gt(movements.id, movementId),
            ),
          ),
        ),
      );
  }

  if (balanceField === "balance_4a") {
    logtail.info(
      "processBalance finished for balance type 4a",
      safeSerialize({
        transactionId,
        balanceId,
      }) as Record<string, unknown>,
    );
  }
};
