import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL?.trim();
const sqlHost = process.env.SQL_HOST?.trim();
const sqlDbName = process.env.SQL_DB_NAME?.trim();
const user = (process.env.SQL_ADMIN_USER || process.env.SQL_USER)?.trim();
const password = (process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD)?.trim();

if (!databaseUrl) {
  if (!sqlHost) {
    throw new Error("DATABASE_URL or SQL_HOST must be set in environment variables.");
  }
  if (!sqlDbName) {
    throw new Error("SQL_DB_NAME must be set in environment variables.");
  }
  if (!user) {
    throw new Error("SQL_ADMIN_USER or SQL_USER must be set in environment variables.");
  }
  if (!password) {
    throw new Error("SQL_ADMIN_PASSWORD or SQL_PASSWORD must be set in environment variables.");
  }
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: databaseUrl
    ? {
        url: databaseUrl,
        ssl: process.env.DATABASE_SSL === "false" ? false : "require",
      }
    : {
        host: sqlHost!,
        port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432,
        user: user!,
        password: password!,
        database: sqlDbName!,
        ssl: process.env.DATABASE_SSL === "true" ? "require" : false,
      },
  verbose: true,
});
