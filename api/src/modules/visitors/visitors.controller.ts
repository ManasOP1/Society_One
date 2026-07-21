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
import { Role, VisitorStatus } from '../../common/types/roles';
import {
  CurrentUser,
  Roles,
  type AuthUser,
} from '../../common/decorators/auth.decorators';
import { RolesGuard, TenantGuard } from '../../common/guards/rbac.guards';
import { resolveSocietyId } from '../../common/utils/tenant.util';
import { VisitorsService } from './visitors.service';

const CreateVisitorSchema = z.object({
  name: z.string().min(1),
  flat: z.string().min(1),
  purpose: z.string().min(1),
  vehicle: z.string().optional(),
  phone: z.string().optional(),
  expectedTime: z.string().optional(),
  status: z.nativeEnum(VisitorStatus).optional(),
  memberId: z.string().optional(),
});
class CreateVisitorDto extends createZodDto(CreateVisitorSchema) {}

@ApiTags('Visitors')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('visitors')
export class VisitorsController {
  constructor(private readonly visitors: VisitorsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN, Role.RESIDENT)
  list(@CurrentUser() user: AuthUser, @Query('societyId') societyId?: string) {
    return this.visitors.list(resolveSocietyId(user, societyId), user);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN, Role.RESIDENT)
  create(
    @Body() body: CreateVisitorDto,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.visitors.create(resolveSocietyId(user, societyId), body, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN, Role.RESIDENT)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.visitors.remove(resolveSocietyId(user, societyId), id, user);
  }
}
