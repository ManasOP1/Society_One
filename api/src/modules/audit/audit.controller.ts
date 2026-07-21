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
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  list(
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const sid =
      user.role === Role.SUPER_ADMIN && !societyId && !user.societyId
        ? null
        : resolveSocietyId(user, societyId);
    return this.audit.list(sid, {
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }
}
