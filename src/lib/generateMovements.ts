import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  lt,
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

  // Initialize all balance values for the movement
  const balanceValues = {
    balance_1: 0,
    balance_1_id: 0,
    balance_2a: 0,
    balance_2a_id: 0,
    balance_2b: 0,
    balance_2b_id: 0,
    balance_3a: 0,
    balance_3a_id: 0,
    balance_3b: 0,
    balance_3b_id: 0,
    balance_4a: 0,
    balance_4a_id: 0,
    balance_4b: 0,
    balance_4b_id: 0,
  };

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

  // Process Type 1: Entity to Entity
  await processBalance(
    transaction,
    tx,
    mvDate,
    account,
    balance1Amount,
    { type: "1", ent_a: ent_a.id, ent_b: ent_b.id },
    balanceValues,
    "balance_1",
    "balance_1_id",
  );

  // Process Type 2a: Entity A to Rest
  await processBalance(
    transaction,
    tx,
    mvDate,
    account,
    balance2aAmount,
    { type: "2", ent_a: ent_a.id },
    balanceValues,
    "balance_2a",
    "balance_2a_id",
  );

  // Process Type 2b: Entity B to Rest
  await processBalance(
    transaction,
    tx,
    mvDate,
    account,
    balance2bAmount,
    { type: "2", ent_a: ent_b.id },
    balanceValues,
    "balance_2b",
    "balance_2b_id",
  );

  // Process Type 3a: Tag A to Entity B
  await processBalance(
    transaction,
    tx,
    mvDate,
    account,
    balance3aAmount,
    { type: "3", tag: ent_a.tagName, ent_a: ent_b.id },
    balanceValues,
    "balance_3a",
    "balance_3a_id",
  );

  // Process Type 3b: Tag B to Entity A
  await processBalance(
    transaction,
    tx,
    mvDate,
    account,
    balance3bAmount,
    { type: "3", tag: ent_b.tagName, ent_a: ent_a.id },
    balanceValues,
    "balance_3b",
    "balance_3b_id",
  );

  // Process Type 4a: Tag A to Rest
  await processBalance(
    transaction,
    tx,
    mvDate,
    account,
    balance4aAmount,
    { type: "4", tag: ent_a.tagName },
    balanceValues,
    "balance_4a",
    "balance_4a_id",
  );

  // Process Type 4b: Tag B to Rest
  await processBalance(
    transaction,
    tx,
    mvDate,
    account,
    balance4bAmount,
    { type: "4", tag: ent_b.tagName },
    balanceValues,
    "balance_4b",
    "balance_4b_id",
  );

  // Create the movement with all the balance values
  const [createdMovement] = await transaction
    .insert(movements)
    .values({
      transactionId: tx.id,
      date: mvDate,
      direction,
      type,
      account,
      ...balanceValues,
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
  balanceValues: Record<string, number | null>,
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

  // Find the most recent balance for this entity combination
  const [balance] = await transaction
    .select({
      id: balances.id,
      amount: balances.amount,
      date: balances.date,
    })
    .from(balances)
    .where(entitiesQuery)
    .orderBy(desc(balances.date))
    .limit(1);

  // Find the most recent balance before the movement date
  const [beforeBalance] = await transaction
    .select({ amount: balances.amount })
    .from(balances)
    .where(
      and(
        entitiesQuery,
        lt(balances.date, moment(mvDate).startOf("day").toDate()),
      ),
    )
    .orderBy(desc(balances.date))
    .limit(1);

  let balanceId: number | null = null;
  let finalAmount = 0;

  const updatedBalancesIds: number[] = [];

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

      if (newBalance) {
        balanceId = newBalance.id;
        finalAmount = newBalance.amount;
      }
    } else {
      updatedBalancesIds.push(oldBalance.id);
      balanceId = oldBalance.id;
      finalAmount = oldBalance.amount;
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
      .returning({ id: balances.id });

    if (updatedBalance) {
      updatedBalancesIds.push(updatedBalance.id);
    }

    balanceId = balance.id;
    finalAmount = balance.amount + balanceAmount;
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
  await transaction
    .update(movements)
    // @ts-expect-error
    .set({ [balanceField]: sql`${movements[balanceField]} + ${balanceAmount}` })
    .where(inArray(movements.balanceId, updatedBalancesIds));

  // Store the calculated values in balanceValues
  balanceValues[balanceField] = finalAmount;
  balanceValues[balanceIdField] = balanceId;
};
