import { beforeEach, describe, expect, it } from "vitest";
import { generateMovements } from "../src/lib/generateMovements";
import { undoMovements } from "../src/lib/undoMovements";
import { MockDatabase, MockRedlock } from "./mockDb";

describe("Edge Cases", () => {
  let mockDb: MockDatabase;
  let mockRedlock: MockRedlock;

  beforeEach(async () => {
    mockDb = new MockDatabase();
    mockRedlock = new MockRedlock();
    await mockDb.clearAll();
  });

  it("should handle the specific case where movement is inserted between movements on same day", async () => {
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

    // Create first movement (10:00 AM)
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
      balance?.id,
      undefined,
      undefined,
    );

    // Create third movement (12:00 PM) - this simulates a future movement
    const thirdMovement = await mockDb.createMovement(
      transaction.id,
      true,
      1,
      "transfer",
      new Date("2025-08-07T12:00:00Z"),
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
      319689.23, // This should be updated when we insert the middle movement
      balance?.id,
      undefined,
      undefined,
    );

    // Now generate a movement that should be inserted between the first and third (11:00 AM)
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
    expect(movements).toHaveLength(3);

    // First movement should remain unchanged
    const firstMovementAfter = movements.find(
      (m) => m.id === firstMovement!.id,
    );
    expect(firstMovementAfter?.balance_4a).toBe(309689.23);

    // Middle movement should have correct balance
    const middleMovement = movements.find(
      (m) => m.id !== firstMovement!.id && m.id !== thirdMovement!.id,
    );
    expect(middleMovement?.balance_4a).toBe(319689.23); // 309689.23 + 10000

    // Third movement should be updated
    const thirdMovementAfter = movements.find(
      (m) => m.id === thirdMovement!.id,
    );
    expect(thirdMovementAfter?.balance_4a).toBe(329689.23); // 319689.23 + 10000
  });

  it("should handle the undo case where earlier movement balance is incorrectly updated", async () => {
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

    // Create first movement (earlier timestamp)
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
      balance?.id,
      undefined,
      undefined,
    );

    // Create second movement (later timestamp) - this will be deleted
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
      balance?.id,
      undefined,
      undefined,
    );

    // Undo movements (this should delete the second movement)
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

    // Verify first movement remains unchanged
    const remainingMovements = await mockDb.getMovements(transaction.id);
    expect(remainingMovements).toHaveLength(1);
    expect(remainingMovements[0]!.id).toBe(firstMovement!.id);
    expect(remainingMovements[0]!.balance_4a).toBe(309689.23); // Should remain unchanged

    // Verify balance was updated correctly
    const balances = await mockDb.getBalances();
    expect(balances).toHaveLength(1);
    expect(balances[0]!.amount).toBe(309689.23); // 319689.23 - 10000
  });

  it("should handle the specific case from the logs where balance was incorrectly calculated", async () => {
    // Create test scenario matching the logs
    const { entity1, entity2, operation, transaction } =
      await mockDb.createTestScenario();

    // Create initial balance matching the logs
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
      balance?.id,
      undefined,
      undefined,
    );

    // Generate second movement (later in the day) - this should get the correct balance
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

    // Second movement should have the correct balance (not the final balance)
    const secondMovement = movements.find((m) => m.id !== firstMovement!.id);
    expect(secondMovement?.balance_4a).toBe(319689.23); // 309689.23 + 10000
  });

  it("should handle the undo case from the logs where earlier movement was incorrectly updated", async () => {
    // Create test scenario matching the logs
    const { entity1, entity2, operation, transaction } =
      await mockDb.createTestScenario();

    // Create initial balance matching the logs
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

    // Create first movement (earlier timestamp) - this should NOT be updated
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
      balance?.id,
      undefined,
      undefined,
    );

    // Create second movement (later timestamp) - this will be deleted
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
      balance?.id,
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

    // Verify only the second movement was deleted
    expect(deletedMovements).toHaveLength(1);
    expect(deletedMovements[0]!.id).toBe(secondMovement!.id);

    // Verify first movement remains unchanged (this was the bug)
    const remainingMovements = await mockDb.getMovements(transaction.id);
    expect(remainingMovements).toHaveLength(1);
    expect(remainingMovements[0]!.id).toBe(firstMovement!.id);
    expect(remainingMovements[0]!.balance_4a).toBe(309689.23); // Should remain unchanged

    // Verify balance was updated correctly
    const balances = await mockDb.getBalances();
    expect(balances).toHaveLength(1);
    expect(balances[0]!.amount).toBe(309689.23); // 319689.23 - 10000
  });
});
