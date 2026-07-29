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
  Public,
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

const GateCheckInSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10).max(15),
  visitType: z.string().min(1),
  companyName: z.string().min(1),
  wingCode: z.string().min(1),
  flatNo: z.string().min(1),
  vehicleType: z.string().min(1),
  vehicleNo: z.string().min(1),
  photoBase64: z.string().min(100),
  createdByName: z.string().optional(),
  deviceId: z.string().max(128).optional(),
});
class GateCheckInDto extends createZodDto(GateCheckInSchema) {}

@ApiTags('Public Gate')
@Controller('public/gate')
export class PublicGateController {
  constructor(private readonly visitors: VisitorsService) {}

  @Public()
  @Get(':token')
  context(@Param('token') token: string) {
    return this.visitors.publicGateContext(token);
  }

  @Public()
  @Get(':token/flats')
  flats(@Param('token') token: string, @Query('wing') wing?: string) {
    if (!wing) {
      return [];
    }
    return this.visitors.publicGateFlats(token, wing);
  }

  @Public()
  @Post(':token/check-in')
  checkIn(@Param('token') token: string, @Body() body: GateCheckInDto) {
    return this.visitors.publicGateCheckIn(token, body);
  }
}

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

  @Get('gate-qr')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  getGateQr(
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.visitors.getGateQr(resolveSocietyId(user, societyId), user);
  }

  @Post('gate-qr')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  ensureGateQr(
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.visitors.ensureGateQr(resolveSocietyId(user, societyId), user);
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
