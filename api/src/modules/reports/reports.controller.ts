import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/types/roles';
import {
  CurrentUser,
  Roles,
  type AuthUser,
} from '../../common/decorators/auth.decorators';
import { RolesGuard, TenantGuard } from '../../common/guards/rbac.guards';
import { resolveSocietyId } from '../../common/utils/tenant.util';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('collection')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  collection(
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
    @Query('month') month?: string,
  ) {
    return this.reports.collectionSummary(
      resolveSocietyId(user, societyId),
      month,
    );
  }

  @Get('outstanding')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  outstanding(
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.reports.outstandingSummary(resolveSocietyId(user, societyId));
  }
}
