import { Test } from "@nestjs/testing";
import { beforeAll, describe, expect, it } from "vitest";
import { DatabaseService } from "../database/database.service.js";
import { HealthController } from "./health.controller.js";

const databaseStub = {
  ping: async () => true,
};

describe("HealthController", () => {
  let controller: HealthController;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DatabaseService, useValue: databaseStub }],
    }).compile();
    controller = module.get(HealthController);
  });

  it("reports liveness without requiring business modules", () => {
    expect(controller.live()).toEqual({ status: "ok" });
  });

  it("reports readiness when the database is reachable", async () => {
    await expect(controller.ready()).resolves.toEqual({
      status: "ready",
      database: "ok",
    });
  });
});
