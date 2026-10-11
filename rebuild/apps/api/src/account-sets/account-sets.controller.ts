import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from "@nestjs/common";
import { createAccountSetSchema } from "./account-set.dto.js";
import { AccountSetsService } from "./account-sets.service.js";

@Controller("account-sets")
export class AccountSetsController {
  constructor(private readonly accountSets: AccountSetsService) {}

  @Get()
  async list() {
    return { data: await this.accountSets.list() };
  }

  @Get(":id")
  async get(@Param("id", ParseIntPipe) id: number) {
    return { data: await this.accountSets.get(id) };
  }

  @Post()
  async create(@Body() body: unknown) {
    const parsed = createAccountSetSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Invalid account set",
        issues: parsed.error.issues.map(({ path, message }) => ({
          path,
          message,
        })),
      });
    }
    return { data: await this.accountSets.create(parsed.data) };
  }
}
