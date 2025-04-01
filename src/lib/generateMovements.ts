import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  lt,
  lte,
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
  const lock = await redlock.acquire([LOCK_MOVEMENTS_KEY], 10_000);

  // Si es caja, quiero que sea siempre la fecha mas nueva, asi va arriba de todo
  const mvDate = account ? new Date() : tx.operation.date;

  // Determine ent_a and ent_b (ent_a is always the one with smaller ID)
  const ent_a = tx.fromEntity.id < tx.toEntity.id ? tx.fromEntity : tx.toEntity;
  const ent_b = tx.fromEntity.id < tx.toEntity.id ? tx.toEntity : tx.fromEntity;

  // Calculate balance amounts for different types
  // Type 1: Entity to Entity (from perspective of ent_a)
  const balance1Amount =
    movementBalanceDirection(tx.fromEntity.id, tx.toEntity.id, direction) *
    tx.amount;

  // Type 2: Entity to Rest - one for each entity
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

  // Type 4: Tag to Rest - one for each tag
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

  // Process balances concurrently in two groups
  const group1Results =
    // Group 1: (1, 2a, 3a)
    Promise.all([
      // Process Type 1: Entity to Entity
      processBalance(
        transaction,
        tx,
        mvDate,
        account,
        balance1Amount,
        { type: "1", ent_a: ent_a.id, ent_b: ent_b.id },
        "balance_1",
        "balance_1_id",
      ),
      // Process Type 2a: Entity A to Rest
      processBalance(
        transaction,
        tx,
        mvDate,
        account,
        balance2aAmount,
        { type: "2", ent_a: ent_a.id },
        "balance_2a",
        "balance_2a_id",
      ),
      // Process Type 3a: Tag A to Entity B
      processBalance(
        transaction,
        tx,
        mvDate,
        account,
        balance3aAmount,
        { type: "3", tag: ent_a.tagName, ent_a: ent_b.id },
        "balance_3a",
        "balance_3a_id",
      ),
    ]);
  // Group 2: (2b, 3b, 4a)
  const group2Results = Promise.all([
    // Process Type 2b: Entity B to Rest
    processBalance(
      transaction,
      tx,
      mvDate,
      account,
      balance2bAmount,
      { type: "2", ent_a: ent_b.id },
      "balance_2b",
      "balance_2b_id",
    ),
    // Process Type 3b: Tag B to Entity A
    processBalance(
      transaction,
      tx,
      mvDate,
      account,
      balance3bAmount,
      { type: "3", tag: ent_b.tagName, ent_a: ent_a.id },
      "balance_3b",
      "balance_3b_id",
    ),
    // Process Type 4a: Tag A to Rest
    processBalance(
      transaction,
      tx,
      mvDate,
      account,
      balance4aAmount,
      { type: "4", tag: ent_a.tagName },
      "balance_4a",
      "balance_4a_id",
    ),
  ]);

  // Extract results
  const [balance1, balance2a, balance3a] = await group1Results;
  const [balance2b, balance3b, balance4a] = await group2Results;
  let balance4b = {
    amount: 0,
    id: 0,
  };

  if (ent_a.tagName === ent_b.tagName) {
    balance4b = balance4a;
  } else {
    balance4b = await processBalance(
      transaction,
      tx,
      mvDate,
      account,
      balance4bAmount,
      { type: "4", tag: ent_b.tagName },
      "balance_4b",
      "balance_4b_id",
    );
  }

  // Create the movement with all the balance values
  const [createdMovement] = await transaction
    .insert(movements)
    .values({
      transactionId: tx.id,
      date: mvDate,
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

  await lock.release();

  return [createdMovement];
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
  account: boolean,
  balanceAmount: number,
  balanceSettings: {
    type: "1" | "2" | "3" | "4";
    ent_a?: number;
    ent_b?: number;
    tag?: string;
  },
  balanceField: string,
  balanceIdField: string,
) => {
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
      .where(
        and(
          entitiesQuery,
          lt(balances.date, moment(mvDate).startOf("day").toDate()),
        ),
      )
      .orderBy(desc(balances.date))
      .limit(1),
  ]);

  const [balance] = balanceResult;
  const [beforeBalance] = beforeBalanceResult;

  let balanceId: number | null = null;
  let finalAmount = 0;

  const updatedBalancesIds: number[] = [];

  console.log({ balance, beforeBalance });

  if (!balance) {
    // No previous balance, create a new one
    const [newBalance] = await transaction
      .insert(balances)
      .values({
        ...balanceSettings,
        account,
        currency: tx.currency,
        date: moment(mvDate).startOf("day").toDate(),
        amount: balanceAmount,
      })
      .returning();

    if (newBalance) {
      balanceId = newBalance.id;
      finalAmount = newBalance.amount;
    }
  } else if (moment(mvDate).isBefore(balance.date, "day")) {
    // Movement date is before the most recent balance
    // Check if we already have a balance for this exact day
    const [oldBalance] = await transaction
      .update(balances)
      .set({ amount: sql`${balances.amount} + ${balanceAmount}` })
      .where(
        and(
          entitiesQuery,
          eq(balances.date, moment(mvDate).startOf("day").toDate()),
        ),
      )
      .returning({ id: balances.id, amount: balances.amount });

    if (!oldBalance) {
      // No balance for this date, create a new one
      const [newBalance] = await transaction
        .insert(balances)
        .values({
          ...balanceSettings,
          account,
          currency: tx.currency,
          date: moment(mvDate).startOf("day").toDate(),
          amount: beforeBalance
            ? beforeBalance.amount + balanceAmount
            : balanceAmount,
        })
        .returning({ id: balances.id, amount: balances.amount });

      balanceId = newBalance!.id;
      finalAmount = newBalance!.amount;
    } else {
      // Search for the previous movement on the oldBalance day which is just before the mvDate
      const [previousMovement] = await transaction
        // @ts-expect-error
        .select({ amount: movements[balanceField] })
        .from(movements)
        .where(
          and(
            // @ts-expect-error
            eq(movements[balanceIdField], oldBalance.id),
            lte(movements.date, mvDate),
            eq(movements.account, account),
          ),
        )
        .orderBy(desc(movements.date), desc(movements.id))
        .limit(1);

      updatedBalancesIds.push(oldBalance.id);
      balanceId = oldBalance.id;
      finalAmount = previousMovement
        ? previousMovement.amount + balanceAmount
        : beforeBalance
        ? beforeBalance.amount + balanceAmount
        : balanceAmount;
    }

    // Update all balances after this date
    const updatedBalances = await transaction
      .update(balances)
      .set({ amount: sql`${balances.amount} + ${balanceAmount}` })
      .where(
        and(
          entitiesQuery,
          gt(balances.date, moment(mvDate).startOf("day").toDate()),
        ),
      )
      .returning({ id: balances.id });

    if (updatedBalances) {
      updatedBalancesIds.push(...updatedBalances.map((b) => b.id));
    }
  } else if (moment(mvDate).isSame(balance.date, "day")) {
    // Movement date is same as most recent balance
    const [updatedBalance] = await transaction
      .update(balances)
      .set({ amount: sql`${balances.amount} + ${balanceAmount}` })
      .where(eq(balances.id, balance.id))
      .returning({ id: balances.id, amount: balances.amount });

    if (updatedBalance) {
      updatedBalancesIds.push(updatedBalance.id);
    }

    // Search for the previous movement on this day
    const [previousMovement] = await transaction
      // @ts-expect-error
      .select({ amount: movements[balanceField] })
      .from(movements)
      .where(
        and(
          // @ts-expect-error
          eq(movements[balanceIdField], balance.id),
          lte(movements.date, mvDate),
          eq(movements.account, account),
        ),
      )
      .orderBy(desc(movements.date), desc(movements.id))
      .limit(1);

    balanceId = updatedBalance!.id;
    // Exists because we have a balance for this day
    finalAmount = previousMovement!.amount + balanceAmount;
  } else {
    // Movement date is after most recent balance
    const [newBalance] = await transaction
      .insert(balances)
      .values({
        ...balanceSettings,
        account,
        currency: tx.currency,
        date: moment(mvDate).startOf("day").toDate(),
        amount: balance.amount + balanceAmount,
      })
      .returning({ id: balances.id, amount: balances.amount });

    if (newBalance) {
      balanceId = newBalance.id;
      finalAmount = newBalance.amount;
    }
  }

  // Enforce that balance ID must exist
  if (balanceId === null) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to create or retrieve balance ID for ${balanceField}`,
    });
  }

  // Update all movements whose balance was updated
  // And their date is after the movement date
  await transaction
    .update(movements)
    // @ts-expect-error
    .set({ [balanceField]: sql`${movements[balanceField]} + ${balanceAmount}` })
    .where(
      and(
        // @ts-expect-error
        inArray(movements[balanceIdField], updatedBalancesIds),
        gt(movements.date, mvDate),
      ),
    );

  return {
    id: balanceId,
    amount: finalAmount,
  };
};
