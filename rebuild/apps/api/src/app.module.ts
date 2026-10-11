import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AccountSetsModule } from "./account-sets/account-sets.module.js";
import { validateEnvironment } from "./config/environment.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";
import { SubjectsModule } from "./subjects/subjects.module.js";
import { VouchersModule } from "./vouchers/vouchers.module.js";
import { ReportsModule } from "./reports/reports.module.js";
import { AccountingPeriodsModule } from "./accounting-periods/accounting-periods.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    AccountSetsModule,
    SubjectsModule,
    VouchersModule,
    ReportsModule,
    AccountingPeriodsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
