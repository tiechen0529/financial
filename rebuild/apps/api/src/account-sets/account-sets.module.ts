import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { AccountSetsController } from "./account-sets.controller.js";
import { AccountSetsService } from "./account-sets.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [AccountSetsController],
  providers: [AccountSetsService],
})
export class AccountSetsModule {}
