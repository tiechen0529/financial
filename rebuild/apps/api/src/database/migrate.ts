import { config as loadDotEnv } from "dotenv";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Kysely, MysqlDialect } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { createPool } from "mysql2";
import type { FinancialDatabase } from "./schema.js";

async function migrate(): Promise<void> {
  loadDotEnv({ path: path.resolve(process.cwd(), "../../.env") });

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required. Copy rebuild/.env.example to rebuild/.env first.",
    );
  }

  const url = new URL(connectionString);
  if (url.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use the mysql: protocol");
  }

  const pool = createPool({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
    decimalNumbers: false,
  });

  const db = new Kysely<FinancialDatabase>({
    dialect: new MysqlDialect({ pool }),
  });
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.resolve(process.cwd(), "src/database/migrations"),
    }),
  });

  try {
    const { error, results } = await migrator.migrateToLatest();
    for (const result of results ?? []) {
      console.log(`${result.status}: ${result.migrationName}`);
    }
    if (error) throw error;
  } finally {
    await db.destroy();
  }
}

void migrate().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
