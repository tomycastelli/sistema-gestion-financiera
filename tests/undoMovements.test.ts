import moment from "moment";
import { beforeEach, describe, expect, it } from "vitest";
import { undoMovements } from "../src/lib/undoMovements";
import { MockDatabase, MockRedlock } from "./mockDb";

describe("undoMovements", () => {
  let mockDb: MockDatabase;
  let mockRedlock: MockRedlock;

  beforeEach(async () => {
    mockDb = new MockDatabase();
    mockRedlock = new MockRedlock();
    await mockDb.clearAll();
  });

  it("should undo movements and update balances correctly", async () => {
    // Create test scenario
    const { entity1, entity2, operation, transaction } =
      await mockDb.createTestScenario();

    // Create initial balance
    const balance = await mockDb.createBalance(
      "4",
      "usd",
      true,
      319689.23,
      new Date("2025-08-07T00:00:00Z"),
      undefined,
      undefined,
      "Maika",
    );

    // Create movement to be deleted
    const movement = await mockDb.createMovement(
      transaction.id,
      true,
      1,
      "transfer",
      new Date("2025-08-07T11:00:00Z"),
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
      319689.23,
      balance!.id,
      undefined,
      undefined,
    );

    // Undo movements
    const deletedMovements = await undoMovements(
      mockDb.db as any,
      {
        id: transaction.id,
        fromEntity: { id: entity1.id!, tagName: entity1.tag.name },
        toEntity: { id: entity2.id!, tagName: entity2.tag.name },
        amount: 10000,
        currency: "usd",
      },
      mockRedlock as any,
    );

    // Verify movement was deleted
    expect(deletedMovements).toHaveLength(1);
    expect(deletedMovements[0]!.id).toBe(movement!.id);

    // Verify balance was updated
    const balances = await mockDb.getBalances();
    expect(balances).toHaveLength(1);

    const updatedBalance = balances[0]!;
    expect(updatedBalance.amount).toBe(309689.23); // 319689.23 - 10000

    // Verify no movements remain
    const movements = await mockDb.getMovements(transaction.id);
    expect(movements).toHaveLength(0);
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
      319689.23,
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

    // Create second movement (later in the day) - this will be deleted
    const secondMovement = await mockDb.createMovement(
      transaction.id,
      true,
      1,
      "transfer",
      new Date("2025-08-07T11:00:00Z"),
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
      319689.23,
      balance!.id,
      undefined,
      undefined,
    );

    // Undo movements (this will delete the second movement)
    const deletedMovements = await undoMovements(
      mockDb.db as any,
      {
        id: transaction.id,
        fromEntity: { id: entity1.id!, tagName: entity1.tag.name },
        toEntity: { id: entity2.id!, tagName: entity2.tag.name },
        amount: 10000,
        currency: "usd",
      },
      mockRedlock as any,
    );

    // Verify only the second movement was deleted
    expect(deletedMovements).toHaveLength(1);
    expect(deletedMovements[0]!.id).toBe(secondMovement!.id);

    // Verify balance was updated
    const balances = await mockDb.getBalances();
    expect(balances).toHaveLength(1);

    const updatedBalance = balances[0]!;
    expect(updatedBalance.amount).toBe(309689.23); // 319689.23 - 10000

    // Verify first movement remains unchanged
    const remainingMovements = await mockDb.getMovements(transaction.id);
    expect(remainingMovements).toHaveLength(1);
    expect(remainingMovements[0]!.id).toBe(firstMovement!.id);
    expect(remainingMovements[0]!.balance_4a).toBe(309689.23); // Should remain unchanged
  });

  it("should update future movements when undoing a movement", async () => {
    // Create test scenario
    const { entity1, entity2, operation, transaction } =
      await mockDb.createTestScenario();

    // Create initial balance
    const balance = await mockDb.createBalance(
      "4",
      "usd",
      true,
      319689.23,
      new Date("2025-08-07T00:00:00Z"),
      undefined,
      undefined,
      "Maika",
    );

    // Create movement to be deleted
    const movementToDelete = await mockDb.createMovement(
      transaction.id,
      true,
      1,
      "transfer",
      new Date("2025-08-07T11:00:00Z"),
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
      319689.23,
      balance!.id,
      undefined,
      undefined,
    );

    // Create future movement (next day)
    const futureMovement = await mockDb.createMovement(
      transaction.id,
      true,
      1,
      "transfer",
      new Date("2025-08-08T10:00:00Z"),
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
      329689.23, // This should be updated
      balance!.id,
      undefined,
      undefined,
    );

    // Undo movements
    const deletedMovements = await undoMovements(
      mockDb.db as any,
      {
        id: transaction.id,
        fromEntity: { id: entity1.id!, tagName: entity1.tag.name },
        toEntity: { id: entity2.id!, tagName: entity2.tag.name },
        amount: 10000,
        currency: "usd",
      },
      mockRedlock as any,
    );

    // Verify movement was deleted
    expect(deletedMovements).toHaveLength(1);
    expect(deletedMovements[0]!.id).toBe(movementToDelete!.id);

    // Verify future movement was updated
    const remainingMovements = await mockDb.getMovements(transaction.id);
    expect(remainingMovements).toHaveLength(1);
    expect(remainingMovements[0]!.id).toBe(futureMovement!.id);
    expect(remainingMovements[0]!.balance_4a).toBe(319689.23); // 329689.23 - 10000
  });

  it("should handle balance type 4a correctly when entities have different tags", async () => {
    // Create test scenario
    const { entity1, entity2, operation, transaction } =
      await mockDb.createTestScenario();

    // Create initial balance
    const balance = await mockDb.createBalance(
      "4",
      "usd",
      true,
      10000,
      new Date("2025-08-07T00:00:00Z"),
      undefined,
      undefined,
      "Maika",
    );

    // Create movement to be deleted
    await mockDb.createMovement(
      transaction.id,
      true,
      1,
      "transfer",
      new Date("2025-08-07T11:00:00Z"),
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
      10000,
      balance!.id,
      -10000,
      balance!.id,
    );

    // Undo movements
    const deletedMovements = await undoMovements(
      mockDb.db as any,
      {
        id: transaction.id,
        fromEntity: { id: entity1.id!, tagName: entity1.tag.name },
        toEntity: { id: entity2.id!, tagName: entity2.tag.name },
        amount: 10000,
        currency: "usd",
      },
      mockRedlock as any,
    );

    // Verify balance was updated
    const balances = await mockDb.getBalances();
    expect(balances).toHaveLength(1);

    const updatedBalance = balances[0]!;
    expect(updatedBalance.amount).toBe(0); // 10000 - 10000
  });

  it("should handle balance type 4a correctly when entities have same tag", async () => {
    // Create test scenario with same tag
    const { entity1, operation, transaction } =
      await mockDb.createTestScenario();
    const entity3 = await mockDb.createEntity("Entity3", "Maika"); // Same tag as entity1

    // Create initial balance
    const balance = await mockDb.createBalance(
      "4",
      "usd",
      true,
      0,
      new Date("2025-08-07T00:00:00Z"),
      undefined,
      undefined,
      "Maika",
    );

    // Create movement to be deleted
    await mockDb.createMovement(
      transaction.id,
      true,
      1,
      "transfer",
      new Date("2025-08-07T11:00:00Z"),
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
      0,
      balance!.id,
      0,
      balance!.id,
    );

    // Undo movements
    const deletedMovements = await undoMovements(
      mockDb.db as any,
      {
        id: transaction.id,
        fromEntity: { id: entity1.id!, tagName: entity1.tag.name },
        toEntity: { id: entity3.id!, tagName: entity3.tag.name },
        amount: 10000,
        currency: "usd",
      },
      mockRedlock as any,
    );

    // Verify balance remains unchanged (should be 0 for same tag)
    const balances = await mockDb.getBalances();
    expect(balances).toHaveLength(1);

    const updatedBalance = balances[0]!;
    expect(updatedBalance.amount).toBe(0); // Should remain 0
  });

  it("should handle negative direction correctly", async () => {
    // Create test scenario
    const { entity1, entity2, operation, transaction } =
      await mockDb.createTestScenario();

    // Create initial balance
    const balance = await mockDb.createBalance(
      "4",
      "usd",
      true,
      -10000,
      new Date("2025-08-07T00:00:00Z"),
      undefined,
      undefined,
      "Maika",
    );

    // Create movement to be deleted
    await mockDb.createMovement(
      transaction.id,
      true,
      -1,
      "transfer",
      new Date("2025-08-07T11:00:00Z"),
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
      -10000,
      balance!.id,
      undefined,
      undefined,
    );

    // Undo movements
    const deletedMovements = await undoMovements(
      mockDb.db as any,
      {
        id: transaction.id,
        fromEntity: { id: entity1.id!, tagName: entity1.tag.name },
        toEntity: { id: entity2.id!, tagName: entity2.tag.name },
        amount: 10000,
        currency: "usd",
      },
      mockRedlock as any,
    );

    // Verify balance was updated
    const balances = await mockDb.getBalances();
    expect(balances).toHaveLength(1);

    const updatedBalance = balances[0]!;
    expect(updatedBalance.amount).toBe(0); // -10000 - (-10000) = 0
  });
});
