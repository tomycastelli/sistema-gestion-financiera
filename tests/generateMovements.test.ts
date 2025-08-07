import { beforeEach, describe, expect, it } from "vitest";
import { generateMovements } from "../src/lib/generateMovements";
import { MockDatabase, MockRedlock } from "./mockDb";

describe("generateMovements", () => {
  let mockDb: MockDatabase;
  let mockRedlock: MockRedlock;

  beforeEach(async () => {
    mockDb = new MockDatabase();
    mockRedlock = new MockRedlock();
    await mockDb.clearAll();
  });

  it("should generate movements for a simple transaction", async () => {
    // Create test scenario
    const { entity1, entity2, operation, transaction } =
      await mockDb.createTestScenario();

    // Create initial balance
    await mockDb.createBalance(
      "4",
      "usd",
      true,
      309689.23,
      new Date("2025-08-07T00:00:00Z"),
      undefined,
      undefined,
      "Maika",
    );

    // Generate movements
    await generateMovements(
      mockDb.db as any,
      {
        ...transaction,
        status: transaction.status as "pending" | "cancelled" | "confirmed",
        is_approved: Boolean(transaction.is_approved),
        fromEntity: { id: entity1.id!, tagName: entity1.tag.name },
        toEntity: { id: entity2.id!, tagName: entity2.tag.name },
        operation: { date: new Date(operation.date) },
      },
      true, // account
      1, // direction
      "transfer",
      mockRedlock as any,
    );

    // Verify movements were created
    const movements = await mockDb.getMovements(transaction.id);
    expect(movements).toHaveLength(1);

    const movement = movements[0]!;
    expect(movement.account).toBe(true);
    expect(movement.direction).toBe(1);
    expect(movement.type).toBe("transfer");
    expect(movement.balance_4a).toBe(319689.23); // 309689.23 + 10000
    expect(movement.balance_4a_id).toBeDefined();
  });

  it("should handle multiple movements on the same day correctly", async () => {
    // Create test scenario
    const { entity1, entity2, operation, transaction } =
      await mockDb.createTestScenario();

    // Create initial balance
    const balance = await mockDb.createBalance(
      "4",
      "usd",
      true,
      309689.23,
      new Date("2025-08-07T00:00:00Z"),
      undefined,
      undefined,
      "Maika",
    );

    // Create first movement (earlier in the day)
    const firstMovement = await mockDb.createMovement(
      transaction.id,
      true,
      1,
      "transfer",
      new Date("2025-08-07T10:00:00Z"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      309689.23,
      balance!.id,
      undefined,
      undefined,
    );

    // Generate second movement (later in the day)
    await generateMovements(
      mockDb.db as any,
      {
        ...transaction,
        status: transaction.status,
        is_approved: transaction.is_approved,
        fromEntity: { id: entity1.id!, tagName: entity1.tag.name },
        toEntity: { id: entity2.id!, tagName: entity2.tag.name },
        operation: { date: operation.date },
      },
      true, // account
      1, // direction
      "transfer",
      mockRedlock as any,
    );

    // Verify movements
    const movements = await mockDb.getMovements(transaction.id);
    expect(movements).toHaveLength(2);

    // First movement should remain unchanged
    const firstMovementAfter = movements.find(
      (m) => m.id === firstMovement!.id,
    );
    expect(firstMovementAfter?.balance_4a).toBe(309689.23);

    // Second movement should have correct balance
    const secondMovement = movements.find((m) => m.id !== firstMovement!.id);
    expect(secondMovement?.balance_4a).toBe(319689.23); // 309689.23 + 10000
  });

  it("should handle balance type 4a correctly when entities have different tags", async () => {
    // Create test scenario
    const { entity1, entity2, operation, transaction } =
      await mockDb.createTestScenario();

    // Generate movements
    await generateMovements(
      mockDb.db as any,
      {
        ...transaction,
        status: transaction.status,
        is_approved: transaction.is_approved,
        fromEntity: { id: entity1.id!, tagName: entity1.tag.name },
        toEntity: { id: entity2.id!, tagName: entity2.tag.name },
        operation: { date: new Date(operation.date) },
      },
      true, // account
      1, // direction
      "transfer",
      mockRedlock as any,
    );

    // Verify movements
    const movements = await mockDb.getMovements(transaction.id);
    expect(movements).toHaveLength(1);

    const movement = movements[0]!;
    expect(movement.balance_4a).toBe(10000); // Should be the transaction amount
    expect(movement.balance_4b).toBe(-10000); // Opposite balance
  });

  it("should handle balance type 4a correctly when entities have same tag", async () => {
    // Create test scenario with same tag
    const { entity1, operation, transaction } =
      await mockDb.createTestScenario();
    const entity3 = await mockDb.createEntity("Entity3", "Maika"); // Same tag as entity1

    // Generate movements
    await generateMovements(
      mockDb.db as any,
      {
        ...transaction,
        status: transaction.status,
        is_approved: transaction.is_approved,
        fromEntity: { id: entity1.id!, tagName: entity1.tag.name },
        toEntity: { id: entity3.id!, tagName: entity3.tag.name },
        operation: { date: operation.date },
      },
      true, // account
      1, // direction
      "transfer",
      mockRedlock as any,
    );

    // Verify movements
    const movements = await mockDb.getMovements(transaction.id);
    expect(movements).toHaveLength(1);

    const movement = movements[0]!;
    expect(movement.balance_4a).toBe(0); // Should be 0 when same tag
    expect(movement.balance_4b).toBe(0); // Should be 0 when same tag
  });

  it("should create new balance when no existing balance for the day", async () => {
    // Create test scenario
    const { entity1, entity2, operation, transaction } =
      await mockDb.createTestScenario();

    // Generate movements without existing balance
    await generateMovements(
      mockDb.db as any,
      {
        ...transaction,
        status: transaction.status,
        is_approved: transaction.is_approved,
        fromEntity: { id: entity1.id!, tagName: entity1.tag.name },
        toEntity: { id: entity2.id!, tagName: entity2.tag.name },
        operation: { date: operation.date },
      },
      true, // account
      1, // direction
      "transfer",
      mockRedlock as any,
    );

    // Verify balance was created
    const balances = await mockDb.getBalances();
    expect(balances).toHaveLength(1);

    const balance = balances[0]!;
    expect(balance.type).toBe("4");
    expect(balance.currency).toBe("usd");
    expect(balance.account).toBe(true);
    expect(balance.amount).toBe(10000);
    expect(balance.tag).toBe("Maika");
  });

  it("should update existing balance when balance exists for the same day", async () => {
    // Create test scenario
    const { entity1, entity2, operation, transaction } =
      await mockDb.createTestScenario();

    // Create existing balance
    await mockDb.createBalance(
      "4",
      "usd",
      true,
      50000,
      new Date("2025-08-07T00:00:00Z"),
      undefined,
      undefined,
      "Maika",
    );

    // Generate movements
    await generateMovements(
      mockDb.db as any,
      {
        ...transaction,
        status: transaction.status,
        is_approved: transaction.is_approved,
        fromEntity: { id: entity1.id!, tagName: entity1.tag.name },
        toEntity: { id: entity2.id!, tagName: entity2.tag.name },
        operation: { date: operation.date },
      },
      true, // account
      1, // direction
      "transfer",
      mockRedlock as any,
    );

    // Verify balance was updated
    const balances = await mockDb.getBalances();
    expect(balances).toHaveLength(1);

    const balance = balances[0]!;
    expect(balance.amount).toBe(60000); // 50000 + 10000
  });

  it("should handle negative direction correctly", async () => {
    // Create test scenario
    const { entity1, entity2, operation, transaction } =
      await mockDb.createTestScenario();

    // Generate movements with negative direction
    await generateMovements(
      mockDb.db as any,
      {
        ...transaction,
        status: transaction.status,
        is_approved: transaction.is_approved,
        fromEntity: { id: entity1.id!, tagName: entity1.tag.name },
        toEntity: { id: entity2.id!, tagName: entity2.tag.name },
        operation: { date: new Date(operation.date) },
      },
      true, // account
      -1, // negative direction
      "transfer",
      mockRedlock as any,
    );

    // Verify movements
    const movements = await mockDb.getMovements(transaction.id);
    expect(movements).toHaveLength(1);

    const movement = movements[0]!;
    expect(movement.direction).toBe(-1);
    expect(movement.balance_4a).toBe(-10000); // Negative amount
  });
});
