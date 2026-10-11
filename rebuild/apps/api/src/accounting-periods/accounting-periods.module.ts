import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { AccountingPeriodsController } from "./accounting-periods.controller.js";
import { AccountingPeriodsService } from "./accounting-periods.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [AccountingPeriodsController],
  providers: [AccountingPeriodsService],
})
export class AccountingPeriodsModule {}
