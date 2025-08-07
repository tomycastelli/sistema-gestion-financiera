import type { ExtractTablesWithRelations } from "drizzle-orm";
import { eq } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type * as schema from "../src/server/db/schema";
import {
  balances,
  balanceType,
  entities,
  movements,
  operations,
  tag,
  transactions,
} from "../src/server/db/schema";
import { testDb } from "./setup";

export type MockTransaction = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export class MockDatabase {
  public db = testDb;

  async clearAll() {
    await this.db.delete(movements);
    await this.db.delete(balances);
    await this.db.delete(transactions);
    await this.db.delete(operations);
    await this.db.delete(entities);
    await this.db.delete(tag);
  }

  async createTag(name: string) {
    // Check if tag already exists
    const existingTag = await this.db
      .select()
      .from(tag)
      .where(eq(tag.name, name));
    if (existingTag.length > 0) {
      return existingTag[0];
    }

    // Create new tag if it doesn't exist
    const [tagObj] = await this.db.insert(tag).values({ name }).returning();
    return tagObj;
  }

  async createEntity(name: string, tagName: string) {
    const tag = await this.createTag(tagName);
    if (!tag) {
      throw new Error("Failed to create tag");
    }
    const [entity] = await this.db
      .insert(entities)
      .values({ name, tagName: tag.name })
      .returning();
    return { ...entity, tag };
  }

  async createOperation(date: Date, observations?: string) {
    const [operation] = await this.db
      .insert(operations)
      .values({
        date,
        observations,
      })
      .returning();
    return operation;
  }

  async createTransaction(
    operationId: number,
    fromEntityId: number,
    toEntityId: number,
    operatorEntityId: number,
    amount: number,
    currency: string,
    type: string,
    status: "cancelled" | "confirmed" | "pending" = "pending",
  ) {
    const [transaction] = await this.db
      .insert(transactions)
      .values({
        operationId,
        fromEntityId,
        toEntityId,
        operatorEntityId,
        amount,
        currency,
        type,
        status,
        is_approved: false,
      })
      .returning();
    return transaction;
  }

  async createBalance(
    type: "1" | "2" | "3" | "4",
    currency: string,
    account: boolean,
    amount: number,
    date: Date,
    ent_a?: number,
    ent_b?: number,
    tag?: string,
  ) {
    const [balance] = await this.db
      .insert(balances)
      .values({
        type,
        currency,
        account,
        amount,
        date,
        ent_a,
        ent_b,
        tag,
      })
      .returning();
    return balance;
  }

  async createMovement(
    transactionId: number,
    account: boolean,
    direction: number,
    type: string,
    date: Date,
    balance_1: number = 0,
    balance_1_id: number = 0,
    balance_2a: number = 0,
    balance_2a_id: number = 0,
    balance_2b: number = 0,
    balance_2b_id: number = 0,
    balance_3a: number = 0,
    balance_3a_id: number = 0,
    balance_3b: number = 0,
    balance_3b_id: number = 0,
    balance_4a: number = 0,
    balance_4a_id: number = 0,
    balance_4b: number = 0,
    balance_4b_id: number = 0,
  ) {
    const [movement] = await this.db
      .insert(movements)
      .values({
        transactionId,
        account,
        direction,
        type,
        date,
        balance_1,
        balance_1_id,
        balance_2a,
        balance_2a_id,
        balance_2b,
        balance_2b_id,
        balance_3a,
        balance_3a_id,
        balance_3b,
        balance_3b_id,
        balance_4a,
        balance_4a_id,
        balance_4b,
        balance_4b_id,
      })
      .returning();
    return movement;
  }

  async getMovements(transactionId?: number) {
    if (transactionId) {
      return await this.db
        .select()
        .from(movements)
        .where(eq(movements.transactionId, transactionId));
    }
    return await this.db.select().from(movements);
  }

  async getBalances() {
    return await this.db.select().from(balances);
  }

  async getTransactions() {
    return await this.db.select().from(transactions);
  }

  // Helper to create a complete test scenario
  async createTestScenario() {
    // Create tags
    const maikaTag = await this.createTag("Maika");
    const otherTag = await this.createTag("Other");

    // Create entities
    const entity1 = await this.createEntity("Entity1", "Maika");
    const entity2 = await this.createEntity("Entity2", "Other");

    if (!entity1 || !entity2) {
      throw new Error("Failed to create entities");
    }

    // Create operation
    const operation = await this.createOperation(
      new Date("2025-08-07T10:00:00Z"),
    );

    if (!operation) {
      throw new Error("Failed to create operation");
    }

    // Create transaction
    const transaction = await this.createTransaction(
      operation.id,
      entity1.id!,
      entity2.id!,
      entity1.id!,
      10000,
      "usd",
      "transfer",
    );

    if (!transaction) {
      throw new Error("Failed to create transaction");
    }

    return {
      maikaTag,
      otherTag,
      entity1,
      entity2,
      operation,
      transaction,
    };
  }
}

// Mock Redlock for testing
export class MockRedlock {
  async acquire(keys: string[], ttl: number) {
    return {
      release: async () => {
        // Mock release
      },
    };
  }
}
