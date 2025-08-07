import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll } from "vitest";
import * as schema from "../src/server/db/schema";

// Global test database instance
export let testDb: ReturnType<typeof drizzle>;
export let postgresContainer: Awaited<
  ReturnType<typeof PostgreSqlContainer.prototype.start>
>;
export let postgresConnection: postgres.Sql;

beforeAll(async () => {
  // Start PostgreSQL container
  postgresContainer = await new PostgreSqlContainer("postgres:16.2-alpine3.19")
    .withDatabase("test_db")
    .withUsername("test_user")
    .withPassword("test_password")
    .start();

  // Get connection details
  const host = postgresContainer.getHost();
  const port = postgresContainer.getPort();

  // Create connection string
  const connectionString = `postgresql://test_user:test_password@${host}:${port}/test_db`;

  // Create postgres connection
  postgresConnection = postgres(connectionString, {
    prepare: true,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
  });

  // Create drizzle instance with actual app schema
  testDb = drizzle(postgresConnection, { schema });

  // Run migrations to create tables
  await migrate(testDb, { migrationsFolder: "./src/server/db/migrations" });
}, 60000); // 60 second timeout for container startup

afterAll(async () => {
  // Clean up connections and container
  if (postgresConnection) {
    await postgresConnection.end();
  }
  if (postgresContainer) {
    await postgresContainer.stop();
  }
});
