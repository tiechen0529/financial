import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  createSubjectSchema,
  updateOpeningBalanceSchema,
  updateSubjectSchema,
} from "./subjects.dto.js";
import { SubjectsService } from "./subjects.service.js";

@Controller("account-sets/:accountSetId/subjects")
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Get()
  async list(@Param("accountSetId", ParseIntPipe) accountSetId: number) {
    return { data: await this.subjects.list(accountSetId) };
  }

  @Post("initialize")
  async initialize(@Param("accountSetId", ParseIntPipe) accountSetId: number) {
    return { data: await this.subjects.initialize(accountSetId) };
  }

  @Post()
  async create(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Body() body: unknown,
  ) {
    const parsed = createSubjectSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "科目信息无效",
        issues: parsed.error.issues.map(({ path, message }) => ({
          path,
          message,
        })),
      });
    }
    return { data: await this.subjects.create(accountSetId, parsed.data) };
  }

  @Patch(":subjectId")
  async update(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Param("subjectId", ParseIntPipe) subjectId: number,
    @Body() body: unknown,
  ) {
    const parsed = updateSubjectSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "科目信息无效",
        issues: parsed.error.issues.map(({ path, message }) => ({
          path,
          message,
        })),
      });
    }
    return {
      data: await this.subjects.update(accountSetId, subjectId, parsed.data),
    };
  }

  @Patch(":subjectId/opening-balance")
  async updateOpeningBalance(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Param("subjectId", ParseIntPipe) subjectId: number,
    @Body() body: unknown,
  ) {
    const parsed = updateOpeningBalanceSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "期初余额无效",
        issues: parsed.error.issues.map(({ path, message }) => ({
          path,
          message,
        })),
      });
    }
    return {
      data: await this.subjects.updateOpeningBalance(
        accountSetId,
        subjectId,
        parsed.data,
      ),
    };
  }

  @Delete(":subjectId")
  async remove(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Param("subjectId", ParseIntPipe) subjectId: number,
  ) {
    await this.subjects.remove(accountSetId, subjectId);
    return { data: { deleted: true } };
  }
}
