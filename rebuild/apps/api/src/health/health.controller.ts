import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  live(): { status: "ok" } {
    return { status: "ok" };
  }

  @Get("ready")
  async ready(): Promise<{ status: "ready"; database: "ok" }> {
    try {
      if (!(await this.database.ping())) {
        throw new ServiceUnavailableException("DATABASE_URL is not configured");
      }
      return { status: "ready", database: "ok" };
    } catch {
      throw new ServiceUnavailableException("Database is not ready");
    }
  }
}
