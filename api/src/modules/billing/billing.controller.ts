import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { InvoiceStatus, Role } from '../../common/types/roles';
import {
  CurrentUser,
  Public,
  Roles,
  type AuthUser,
} from '../../common/decorators/auth.decorators';
import { RolesGuard, TenantGuard } from '../../common/guards/rbac.guards';
import { resolveSocietyId } from '../../common/utils/tenant.util';
import { BillingService } from './billing.service';

const GenerateMonthlySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
});
class GenerateMonthlyDto extends createZodDto(GenerateMonthlySchema) {}

@ApiTags('Public')
@Controller()
export class PublicBillingController {
  constructor(private readonly billing: BillingService) {}

  /** Shareable invoice page — no auth. */
  @Public()
  @Get('public/invoices/:invoiceNo')
  getPublic(@Param('invoiceNo') invoiceNo: string) {
    return this.billing.getPublicByInvoiceNo(invoiceNo);
  }
}

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('invoices')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN, Role.RESIDENT)
  list(
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
    @Query('status') status?: InvoiceStatus,
    @Query('month') month?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.billing.list(resolveSocietyId(user, societyId), user, {
      status,
      month,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('generate-monthly')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  generateMonthly(
    @Body() body: GenerateMonthlyDto,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.billing.generateMonthly(
      resolveSocietyId(user, societyId),
      body.month,
      user,
    );
  }

  @Get(':invoiceNo')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN, Role.RESIDENT)
  get(
    @Param('invoiceNo') invoiceNo: string,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.billing.getByInvoiceNo(
      resolveSocietyId(user, societyId),
      invoiceNo,
      user,
    );
  }

  @Delete(':invoiceNo')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  remove(
    @Param('invoiceNo') invoiceNo: string,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.billing.remove(
      resolveSocietyId(user, societyId),
      invoiceNo,
      user,
    );
  }
}
