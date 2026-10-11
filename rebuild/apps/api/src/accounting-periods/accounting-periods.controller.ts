import { Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { AccountingPeriodsService } from "./accounting-periods.service.js";

@Controller("account-sets/:accountSetId/periods")
export class AccountingPeriodsController {
  constructor(private readonly periods: AccountingPeriodsService) {}

  @Get()
  async list(@Param("accountSetId", ParseIntPipe) accountSetId: number) {
    return { data: await this.periods.list(accountSetId) };
  }

  @Post(":year/:month/close")
  async close(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Param("year", ParseIntPipe) year: number,
    @Param("month", ParseIntPipe) month: number,
  ) {
    return { data: await this.periods.close(accountSetId, year, month) };
  }

  @Post(":year/:month/reopen")
  async reopen(
    @Param("accountSetId", ParseIntPipe) accountSetId: number,
    @Param("year", ParseIntPipe) year: number,
    @Param("month", ParseIntPipe) month: number,
  ) {
    return { data: await this.periods.reopen(accountSetId, year, month) };
  }
}
