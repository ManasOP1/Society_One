import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/types/roles';
import {
  CurrentUser,
  Roles,
  type AuthUser,
} from '../../common/decorators/auth.decorators';
import { RolesGuard, TenantGuard } from '../../common/guards/rbac.guards';
import { resolveSocietyId } from '../../common/utils/tenant.util';
import { ReceiptsService } from './receipts.service';

@ApiTags('Receipts')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN, Role.RESIDENT)
  list(
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
    @Query('month') month?: string,
  ) {
    return this.receipts.list(resolveSocietyId(user, societyId), user, {
      month,
    });
  }

  @Get(':receiptNo')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN, Role.RESIDENT)
  get(
    @Param('receiptNo') receiptNo: string,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.receipts.getByReceiptNo(
      resolveSocietyId(user, societyId),
      receiptNo,
      user,
    );
  }
}
