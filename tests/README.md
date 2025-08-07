# Testing Setup for Movement Functions

This directory contains a comprehensive testing setup for the `generateMovements` and `undoMovements` functions using an in-memory SQLite database.

## Setup

### 1. Install Dependencies

First, install the testing dependencies:

```bash
pnpm install
```

### 2. Run Tests

```bash
# Run all tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests once
pnpm test:run
```

## Test Structure

### Files

- `setup.ts` - Global test setup with in-memory SQLite database
- `mockDb.ts` - Mock database helper with utilities for creating test data
- `generateMovements.test.ts` - Tests for the `generateMovements` function
- `undoMovements.test.ts` - Tests for the `undoMovements` function
- `edgeCases.test.ts` - Tests for specific edge cases that were causing issues

### Mock Database

The `MockDatabase` class provides utilities to:

- Create test entities, tags, operations, transactions, balances, and movements
- Clear all data between tests
- Query movements and balances
- Create complete test scenarios

### Test Scenarios

The tests cover:

1. **Basic Functionality**

   - Simple movement generation
   - Balance creation and updates
   - Different entity tag combinations

2. **Edge Cases**

   - Multiple movements on the same day
   - Inserting movements between existing movements
   - Undoing movements with proper chronological order

3. **Specific Issues**
   - The balance calculation bug that was fixed
   - The undo movement bug that was fixed
   - Date normalization issues

## Example Test

```typescript
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

  // Generate movements
  await generateMovements(
    mockDb.db as any,
    {
      ...transaction,
      fromEntity: { id: entity1.id, tagName: entity1.tag.name },
      toEntity: { id: entity2.id, tagName: entity2.tag.name },
      operation: { date: operation.date },
    },
    true, // account
    1, // direction
    "transfer",
    mockRedlock as any,
  );

  // Verify results
  const movements = await mockDb.getMovements(transaction.id);
  expect(movements).toHaveLength(1);
  expect(movements[0].balance_4a).toBe(319689.23);
});
```

## Key Features

1. **In-Memory Database**: Uses SQLite in-memory for fast, isolated tests
2. **Real Schema**: Uses the actual Drizzle schema from your application
3. **Comprehensive Coverage**: Tests all the edge cases that were causing issues
4. **Easy Setup**: Simple helper methods to create test scenarios
5. **Isolation**: Each test runs in isolation with fresh data

## Running Specific Tests

```bash
# Run only generateMovements tests
pnpm test generateMovements

# Run only undoMovements tests
pnpm test undoMovements

# Run only edge cases
pnpm test edgeCases
```

## Debugging

If tests fail, you can:

1. Use the UI mode: `pnpm test:ui`
2. Add console.log statements in the test files
3. Check the database state using `mockDb.getMovements()` and `mockDb.getBalances()`

## Adding New Tests

To add new tests:

1. Create a new test file or add to existing files
2. Use the `MockDatabase` helper methods to set up test data
3. Call the functions you want to test
4. Verify the results using assertions

The mock database makes it easy to recreate any scenario you encounter in production.
