import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { VouchersController } from "./vouchers.controller.js";
import { VouchersService } from "./vouchers.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [VouchersController],
  providers: [VouchersService],
  exports: [VouchersService],
})
export class VouchersModule {}
