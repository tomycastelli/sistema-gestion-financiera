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
  // Use a global lock for all balance calculations to ensure complete serialization
  const lock = await redlock.acquire([LOCK_MOVEMENTS_KEY], 30_000);

  try {
    // Delete the movement
    const deletedMovements = await transaction
      .delete(movements)
      .where(eq(movements.transactionId, tx.id))
      .returning();

    // Determine ent_a and ent_b (ent_a is always the one with smaller ID)
    const ent_a =
      tx.fromEntity.id < tx.toEntity.id ? tx.fromEntity : tx.toEntity;
    const ent_b =
      tx.fromEntity.id < tx.toEntity.id ? tx.toEntity : tx.fromEntity;

    for (const movement of deletedMovements) {
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

      // Process all balances sequentially to ensure consistency
      await processBalance(
        transaction,
        movement.balance_1_id,
        balance1Amount,
        movement.date,
        "balance_1",
        "balance_1_id",
        movement.id,
      );

      await processBalance(
        transaction,
        movement.balance_2a_id,
        balance2aAmount,
        movement.date,
        "balance_2a",
        "balance_2a_id",
        movement.id,
      );

      await processBalance(
        transaction,
        movement.balance_2b_id,
        balance2bAmount,
        movement.date,
        "balance_2b",
        "balance_2b_id",
        movement.id,
      );

      await processBalance(
        transaction,
        movement.balance_3a_id,
        balance3aAmount,
        movement.date,
        "balance_3a",
        "balance_3a_id",
        movement.id,
      );

      await processBalance(
        transaction,
        movement.balance_3b_id,
        balance3bAmount,
        movement.date,
        "balance_3b",
        "balance_3b_id",
        movement.id,
      );

      await processBalance(
        transaction,
        movement.balance_4a_id,
        balance4aAmount,
        movement.date,
        "balance_4a",
        "balance_4a_id",
        movement.id,
      );

      // Process 4b only if entities have different tags
      if (tx.fromEntity.tagName !== tx.toEntity.tagName) {
        await processBalance(
          transaction,
          movement.balance_4b_id,
          balance4bAmount,
          movement.date,
          "balance_4b",
          "balance_4b_id",
          movement.id,
        );
      }
    }

    return deletedMovements;
  } finally {
    await lock.release();
  }
};

// Helper function to process each balance type
const processBalance = async (
  transaction: PgTransaction<
    PostgresJsQueryResultHKT,
    typeof schema,
    ExtractTablesWithRelations<typeof schema>
  >,
  balanceId: number,
  balanceAmount: number,
  mvDate: Date,
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
  const oppositeBalanceField = getOppositeBalanceField(balanceField);
  const oppositeBalanceIdField = getOppositeBalanceIdField(balanceIdField);

  // Get the balance to be updated
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
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Balance with ID ${balanceId} not found`,
    });
  }

  // Construct query condition for future balances
  const futureBalancesQuery = and(
    eq(balances.type, balance.type),
    eq(balances.currency, balance.currency),
    eq(balances.account, balance.account),
    balance.ent_a ? eq(balances.ent_a, balance.ent_a) : undefined,
    balance.ent_b ? eq(balances.ent_b, balance.ent_b) : undefined,
    balance.tag ? eq(balances.tag, balance.tag) : undefined,
    gt(balances.date, moment(mvDate).startOf("day").toDate()),
  );

  // Update the current balance
  await transaction
    .update(balances)
    .set({ amount: sql`${balances.amount} - ${balanceAmount}` })
    .where(eq(balances.id, balanceId));

  // Update all future balances
  const updatedBalances = await transaction
    .update(balances)
    .set({ amount: sql`${balances.amount} - ${balanceAmount}` })
    .where(futureBalancesQuery)
    .returning({ id: balances.id });

  const allBalances = [...updatedBalances.map((b) => b.id), balanceId];

  // Update all movements related to these balances which come after the deleted balance
  await transaction
    .update(movements)
    .set({
      [balanceField]: sql`${movements[balanceField]} - ${balanceAmount}`,
    })
    .where(
      and(
        or(
          gt(movements.date, mvDate),
          and(eq(movements.date, mvDate), gt(movements.id, movementId)),
        ),
        inArray(movements[balanceIdField], allBalances),
      ),
    );

  if (oppositeBalanceField && oppositeBalanceIdField) {
    await transaction
      .update(movements)
      .set({
        [oppositeBalanceField]: sql`${movements[oppositeBalanceField]} - ${balanceAmount}`,
      })
      .where(
        and(
          inArray(movements[oppositeBalanceIdField], allBalances),
          gt(movements.date, mvDate),
        ),
      );
  }
};
