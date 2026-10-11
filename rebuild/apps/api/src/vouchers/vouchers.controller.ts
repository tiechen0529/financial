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
  Query,
} from "@nestjs/common";
import { voucherInputSchema } from "./vouchers.dto.js";
import { VouchersService } from "./vouchers.service.js";

@Controller("account-sets/:accountSetId/vouchers")
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Get()
  async list(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Query("year") year?: string,
    @Query("month") month?: string,
  ) {
    return { data: await this.vouchers.list(accountSetId, year, month) };
  }

  @Get(":voucherId")
  async get(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Param("voucherId", ParseIntPipe) voucherId: number,
  ) {
    return { data: await this.vouchers.get(accountSetId, voucherId) };
  }

  @Post()
  async create(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Body() body: unknown,
  ) {
    const parsed = voucherInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "凭证内容无效",
        issues: parsed.error.issues.map(({ path, message }) => ({
          path,
          message,
        })),
      });
    }
    return { data: await this.vouchers.create(accountSetId, parsed.data) };
  }

  @Patch(":voucherId")
  async updateDraft(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Param("voucherId", ParseIntPipe) voucherId: number,
    @Body() body: unknown,
  ) {
    const parsed = voucherInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "凭证内容无效",
        issues: parsed.error.issues.map(({ path, message }) => ({
          path,
          message,
        })),
      });
    }
    return {
      data: await this.vouchers.updateDraft(
        accountSetId,
        voucherId,
        parsed.data,
      ),
    };
  }

  @Post(":voucherId/post")
  async post(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Param("voucherId", ParseIntPipe) voucherId: number,
  ) {
    return { data: await this.vouchers.post(accountSetId, voucherId) };
  }

  @Delete(":voucherId")
  async removeDraft(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Param("voucherId", ParseIntPipe) voucherId: number,
  ) {
    await this.vouchers.removeDraft(accountSetId, voucherId);
    return { data: { deleted: true } };
  }
}
