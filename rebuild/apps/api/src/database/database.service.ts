import {
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kysely, MysqlDialect } from "kysely";
import { createPool, type Pool } from "mysql2";
import type { FinancialDatabase } from "./schema.js";

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly db: Kysely<FinancialDatabase> | undefined;
  private readonly pool: Pool | undefined;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>("DATABASE_URL");
    if (!connectionString) return;

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
      dateStrings: ["DATE"],
    });

    this.pool = pool;
    this.db = new Kysely<FinancialDatabase>({
      dialect: new MysqlDialect({ pool }),
    });
  }

  get isConfigured(): boolean {
    return this.db !== undefined;
  }

  requireDatabase(): Kysely<FinancialDatabase> {
    if (!this.db) {
      throw new ServiceUnavailableException("DATABASE_URL is not configured");
    }
    return this.db;
  }

  async ping(): Promise<boolean> {
    if (!this.pool) return false;
    await this.pool.promise().query("SELECT 1");
    return true;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.db?.destroy();
  }
}
