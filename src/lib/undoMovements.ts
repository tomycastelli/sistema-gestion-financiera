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
import logtail from "./logger";
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
  logtail.info("undoMovements started", {
    transactionId: tx.id,
    fromEntity: { id: tx.fromEntity.id, tagName: tx.fromEntity.tagName },
    toEntity: { id: tx.toEntity.id, tagName: tx.toEntity.tagName },
    amount: tx.amount,
    currency: tx.currency,
  });

  // Use a global lock for all balance calculations to ensure complete serialization
  const lock = await redlock.acquire([LOCK_MOVEMENTS_KEY], 30_000);

  try {
    // Delete the movement
    logtail.info("Deleting movements for transaction", {
      transactionId: tx.id,
    });
    const deletedMovements = await transaction
      .delete(movements)
      .where(eq(movements.transactionId, tx.id))
      .returning();

    logtail.info("Movements deleted", {
      transactionId: tx.id,
      deletedMovementsCount: deletedMovements.length,
      deletedMovementIds: deletedMovements.map((m) => m.id),
    });

    // Determine ent_a and ent_b (ent_a is always the one with smaller ID)
    const ent_a =
      tx.fromEntity.id < tx.toEntity.id ? tx.fromEntity : tx.toEntity;
    const ent_b =
      tx.fromEntity.id < tx.toEntity.id ? tx.toEntity : tx.fromEntity;

    logtail.info("Entity order determined", {
      transactionId: tx.id,
      ent_a: { id: ent_a.id, tagName: ent_a.tagName },
      ent_b: { id: ent_b.id, tagName: ent_b.tagName },
    });

    for (const movement of deletedMovements) {
      logtail.info("Processing deleted movement", {
        transactionId: tx.id,
        movementId: movement.id,
        movementDate: movement.date.toISOString(),
        direction: movement.direction,
        account: movement.account,
      });

      // Normalize movement date to UTC start of day for consistency
      const normalizedMvDate = moment(movement.date)
        .utc()
        .startOf("day")
        .toDate();

      logtail.info("Movement date normalized", {
        transactionId: tx.id,
        movementId: movement.id,
        originalDate: movement.date.toISOString(),
        normalizedDate: normalizedMvDate.toISOString(),
      });

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

      logtail.info("Balance amounts calculated", {
        transactionId: tx.id,
        movementId: movement.id,
        balance1Amount,
        balance2aAmount,
        balance2bAmount,
        balance3aAmount,
        balance3bAmount,
        balance4aAmount,
        balance4bAmount,
      });

      // Process all balances sequentially to ensure consistency
      logtail.info("Processing balance type 1", {
        transactionId: tx.id,
        movementId: movement.id,
        balanceId: movement.balance_1_id,
        amount: balance1Amount,
      });
      await processBalance(
        transaction,
        tx.id,
        movement.balance_1_id,
        balance1Amount,
        normalizedMvDate,
        "balance_1",
        "balance_1_id",
        movement.id,
      );

      logtail.info("Processing balance type 2a", {
        transactionId: tx.id,
        movementId: movement.id,
        balanceId: movement.balance_2a_id,
        amount: balance2aAmount,
      });
      await processBalance(
        transaction,
        tx.id,
        movement.balance_2a_id,
        balance2aAmount,
        normalizedMvDate,
        "balance_2a",
        "balance_2a_id",
        movement.id,
      );

      logtail.info("Processing balance type 2b", {
        transactionId: tx.id,
        movementId: movement.id,
        balanceId: movement.balance_2b_id,
        amount: balance2bAmount,
      });
      await processBalance(
        transaction,
        tx.id,
        movement.balance_2b_id,
        balance2bAmount,
        normalizedMvDate,
        "balance_2b",
        "balance_2b_id",
        movement.id,
      );

      logtail.info("Processing balance type 3a", {
        transactionId: tx.id,
        movementId: movement.id,
        balanceId: movement.balance_3a_id,
        amount: balance3aAmount,
      });
      await processBalance(
        transaction,
        tx.id,
        movement.balance_3a_id,
        balance3aAmount,
        normalizedMvDate,
        "balance_3a",
        "balance_3a_id",
        movement.id,
      );

      logtail.info("Processing balance type 3b", {
        transactionId: tx.id,
        movementId: movement.id,
        balanceId: movement.balance_3b_id,
        amount: balance3bAmount,
      });
      await processBalance(
        transaction,
        tx.id,
        movement.balance_3b_id,
        balance3bAmount,
        normalizedMvDate,
        "balance_3b",
        "balance_3b_id",
        movement.id,
      );

      logtail.info("Processing balance type 4a", {
        transactionId: tx.id,
        movementId: movement.id,
        balanceId: movement.balance_4a_id,
        amount: balance4aAmount,
      });
      await processBalance(
        transaction,
        tx.id,
        movement.balance_4a_id,
        balance4aAmount,
        normalizedMvDate,
        "balance_4a",
        "balance_4a_id",
        movement.id,
      );

      // Process 4b only if entities have different tags
      if (tx.fromEntity.tagName !== tx.toEntity.tagName) {
        logtail.info("Processing balance type 4b", {
          transactionId: tx.id,
          movementId: movement.id,
          balanceId: movement.balance_4b_id,
          amount: balance4bAmount,
        });
        await processBalance(
          transaction,
          tx.id,
          movement.balance_4b_id,
          balance4bAmount,
          normalizedMvDate,
          "balance_4b",
          "balance_4b_id",
          movement.id,
        );
      } else {
        logtail.info("Skipping balance type 4b - same tag", {
          transactionId: tx.id,
          movementId: movement.id,
          fromTag: tx.fromEntity.tagName,
          toTag: tx.toEntity.tagName,
        });
      }
    }

    logtail.info("undoMovements completed", {
      transactionId: tx.id,
      deletedMovementsCount: deletedMovements.length,
    });

    return deletedMovements;
  } finally {
    await lock.release();
    logtail.info("Lock released", {
      transactionId: tx.id,
    });
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
  logtail.info("processBalance started", {
    transactionId,
    balanceId,
    balanceAmount,
    balanceField,
    balanceIdField,
    mvDate: mvDate.toISOString(),
    movementId,
  });

  const oppositeBalanceField = getOppositeBalanceField(balanceField);
  const oppositeBalanceIdField = getOppositeBalanceIdField(balanceIdField);

  logtail.info("Opposite balance fields determined", {
    transactionId,
    balanceField,
    oppositeBalanceField,
    balanceIdField,
    oppositeBalanceIdField,
  });

  // Get the balance to be updated
  logtail.info("Fetching balance details", {
    transactionId,
    balanceId,
  });
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
    logtail.error("Balance not found", {
      transactionId,
      balanceId,
    });
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Balance with ID ${balanceId} not found`,
    });
  }

  logtail.info("Balance details fetched", {
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
  });

  // Construct query condition for future balances
  // mvDate is normalized to UTC start of day from the calling function
  const futureBalancesQuery = and(
    eq(balances.type, balance.type),
    eq(balances.currency, balance.currency),
    eq(balances.account, balance.account),
    balance.ent_a ? eq(balances.ent_a, balance.ent_a) : undefined,
    balance.ent_b ? eq(balances.ent_b, balance.ent_b) : undefined,
    balance.tag ? eq(balances.tag, balance.tag) : undefined,
    gt(balances.date, mvDate),
  );

  logtail.info("Future balances query constructed", {
    transactionId,
    balanceId,
    futureBalancesQuery,
  });

  // Update the current balance
  logtail.info("Updating current balance", {
    transactionId,
    balanceId,
    currentAmount: balance.amount,
    amountToSubtract: balanceAmount,
    newAmount: balance.amount - balanceAmount,
  });
  await transaction
    .update(balances)
    .set({ amount: sql`${balances.amount} - ${balanceAmount}` })
    .where(eq(balances.id, balanceId));

  // Update all future balances
  logtail.info("Updating future balances", {
    transactionId,
    balanceId,
  });
  const updatedBalances = await transaction
    .update(balances)
    .set({ amount: sql`${balances.amount} - ${balanceAmount}` })
    .where(futureBalancesQuery)
    .returning({ id: balances.id });

  logtail.info("Future balances updated", {
    transactionId,
    balanceId,
    updatedBalancesCount: updatedBalances.length,
    updatedBalanceIds: updatedBalances.map((b) => b.id),
  });

  const allBalances = [...updatedBalances.map((b) => b.id), balanceId];

  logtail.info("All affected balances", {
    transactionId,
    balanceId,
    allBalances,
  });

  // Update all movements related to these balances which come after the deleted balance
  logtail.info("Updating movements for balance type", {
    transactionId,
    balanceId,
    balanceField,
    allBalances,
    mvDate: mvDate.toISOString(),
    movementId,
  });
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
    logtail.info("Updating opposite movements for balance type", {
      transactionId,
      balanceId,
      balanceField,
      oppositeBalanceField,
      allBalances,
    });
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

  logtail.info("processBalance finished", {
    transactionId,
    balanceId,
    balanceField,
  });
};
