import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./db/schema";

import { env } from "~/env.mjs";

let connection: postgres.Sql;

if (process.env.NODE_ENV === "production") {
  connection = postgres(env.DATABASE_URL, {
    prepare: true,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
  });
} else {
  const globalConnection = global as typeof globalThis & {
    connection: postgres.Sql;
  };

  if (!globalConnection.connection) {
    globalConnection.connection = postgres(env.DATABASE_URL, {
      prepare: true,
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 60 * 30,
    });
  }

  connection = globalConnection.connection;
}

export const db = drizzle(connection, {
  schema,
  logger: false,
});
