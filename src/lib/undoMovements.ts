import { TRPCError } from "@trpc/server";
import {
  and,
  eq,
  gt,
  inArray,
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
import { LOCK_MOVEMENTS_KEY } from "./variables";

export const undoMovements = async (
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
  const lock = await redlock.acquire([LOCK_MOVEMENTS_KEY], 10_000);

  // Delete the movement
  const deletedMovements = await transaction
    .delete(movements)
    .where(eq(movements.transactionId, tx.id))
    .returning();

  // Si es caja, quiero que sea siempre la fecha mas nueva, asi va arriba de todo
  const mvDate = account ? new Date() : tx.operation.date;

  // Determine ent_a and ent_b (ent_a is always the one with smaller ID)
  const ent_a = tx.fromEntity.id < tx.toEntity.id ? tx.fromEntity : tx.toEntity;
  const ent_b = tx.fromEntity.id < tx.toEntity.id ? tx.toEntity : tx.fromEntity;

  // Calculate balance amounts for different types (reversed from original)
  // Type 1: Entity to Entity (from perspective of ent_a)
  const balance1Amount =
    -movementBalanceDirection(tx.fromEntity.id, tx.toEntity.id, direction) *
    tx.amount;

  // Type 2: Entity to Rest - one for each entity
  const balance2aAmount =
    tx.fromEntity.id === ent_a.id
      ? tx.amount * direction
      : -tx.amount * direction;
  const balance2bAmount =
    tx.toEntity.id === ent_b.id
      ? -tx.amount * direction
      : tx.amount * direction;

  // Type 3: Tag to Entity
  const balance3aAmount =
    tx.fromEntity.tagName === tx.toEntity.tagName
      ? 0
      : tx.fromEntity.id === ent_a.id
      ? tx.amount * direction
      : -tx.amount * direction;
  const balance3bAmount =
    tx.fromEntity.tagName === tx.toEntity.tagName
      ? 0
      : tx.toEntity.id === ent_b.id
      ? -tx.amount * direction
      : tx.amount * direction;

  // Type 4: Tag to Rest - one for each tag
  const balance4aAmount =
    tx.fromEntity.tagName === tx.toEntity.tagName
      ? 0
      : tx.fromEntity.tagName === ent_a.tagName
      ? tx.amount * direction
      : -tx.amount * direction;
  const balance4bAmount =
    tx.fromEntity.tagName === tx.toEntity.tagName
      ? 0
      : tx.toEntity.tagName === ent_b.tagName
      ? -tx.amount * direction
      : tx.amount * direction;

  for (const movement of deletedMovements) {
    // Process each balance type using the IDs from the movement
    await processBalance(
      transaction,
      movement.balance_1_id,
      balance1Amount,
      mvDate,
      "balance_1",
    );

    await processBalance(
      transaction,
      movement.balance_2a_id,
      balance2aAmount,
      mvDate,
      "balance_2a",
    );

    await processBalance(
      transaction,
      movement.balance_2b_id,
      balance2bAmount,
      mvDate,
      "balance_2b",
    );

    await processBalance(
      transaction,
      movement.balance_3a_id,
      balance3aAmount,
      mvDate,
      "balance_3a",
    );

    await processBalance(
      transaction,
      movement.balance_3b_id,
      balance3bAmount,
      mvDate,
      "balance_3b",
    );

    await processBalance(
      transaction,
      movement.balance_4a_id,
      balance4aAmount,
      mvDate,
      "balance_4a",
    );

    await processBalance(
      transaction,
      movement.balance_4b_id,
      balance4bAmount,
      mvDate,
      "balance_4b",
    );
  }

  await lock.release();

  return deletedMovements;
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
  balanceField: string,
) => {
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
    .set({ amount: sql`${balances.amount} + ${balanceAmount}` })
    .where(eq(balances.id, balanceId));

  // Update all movements related to this balance which come after the deleted balance
  await transaction
    .update(movements)
    // @ts-expect-error
    .set({ [balanceField]: sql`${movements[balanceField]} - ${balanceAmount}` })
    .where(
      and(
        gt(movements.date, moment(mvDate).startOf("day").toDate()),
        // @ts-expect-error
        eq(movements[balanceField + "_id"], balanceId),
      ),
    );

  // Update all future balances
  const updatedBalances = await transaction
    .update(balances)
    .set({ amount: sql`${balances.amount} + ${balanceAmount}` })
    .where(futureBalancesQuery)
    .returning({ id: balances.id });

  // Update all movements related to these balances
  await transaction
    .update(movements)
    // @ts-expect-error
    .set({ [balanceField]: sql`${movements[balanceField]} - ${balanceAmount}` })
    .where(
      inArray(
        // @ts-expect-error
        movements[balanceField + "_id"],
        updatedBalances.map((b) => b.id),
      ),
    );
};
