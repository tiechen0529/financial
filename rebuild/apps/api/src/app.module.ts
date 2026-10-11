import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AccountSetsModule } from "./account-sets/account-sets.module.js";
import { validateEnvironment } from "./config/environment.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthController } from "./health/health.controller.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    AccountSetsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
