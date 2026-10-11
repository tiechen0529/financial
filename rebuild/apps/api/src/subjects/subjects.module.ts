import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { SubjectsController } from "./subjects.controller.js";
import { SubjectsService } from "./subjects.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [SubjectsController],
  providers: [SubjectsService],
  exports: [SubjectsService],
})
export class SubjectsModule {}
