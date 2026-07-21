import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Role } from '../../common/types/roles';
import {
  CurrentUser,
  Roles,
  type AuthUser,
} from '../../common/decorators/auth.decorators';
import { RolesGuard, TenantGuard } from '../../common/guards/rbac.guards';
import { resolveSocietyId } from '../../common/utils/tenant.util';
import { SettingsService } from './settings.service';

const UpdateSettingsSchema = z.object({
  societyName: z.string().min(2).optional(),
  address: z.string().min(1).optional(),
  registrationNo: z.string().nullable().optional(),
  panNumber: z.string().nullable().optional(),
  logoText: z.string().optional(),
  /** HTTP(S) URL or data:image/… base64 from the admin upload flow. */
  logoUrl: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  bankAccount: z.string().nullable().optional(),
  bankIfsc: z.string().nullable().optional(),
  upiId: z.string().nullable().optional(),
  invoicePrefix: z.string().min(1).optional(),
  receiptPrefix: z.string().min(1).optional(),
  maintenanceAmount: z.number().nonnegative().optional(),
  maintenanceAmount1Bhk: z.number().nonnegative().optional(),
  maintenanceAmount2Bhk: z.number().nonnegative().optional(),
  maintenanceAmount3Bhk: z.number().nonnegative().optional(),
  lateFeeAmount: z.number().nonnegative().optional(),
  dueDay: z.number().int().min(1).max(28).optional(),
  municipalDues: z.number().nonnegative().optional(),
  adminExpenses: z.number().nonnegative().optional(),
  sinkingFunds: z.number().nonnegative().optional(),
  buildingMaintenance: z.number().nonnegative().optional(),
  parkingCharges: z.number().nonnegative().optional(),
  nonOccupancyCharges: z.number().nonnegative().optional(),
  gstNote: z.string().nullable().optional(),
  interestNote: z.string().nullable().optional(),
  razorpayKeyId: z.string().nullable().optional(),
});
class UpdateSettingsDto extends createZodDto(UpdateSettingsSchema) {}

@ApiTags('Society Settings')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('society/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN, Role.RESIDENT)
  get(@CurrentUser() user: AuthUser, @Query('societyId') societyId?: string) {
    return this.settings.get(resolveSocietyId(user, societyId));
  }

  @Patch()
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  update(
    @Body() body: UpdateSettingsDto,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.settings.update(resolveSocietyId(user, societyId), body, user);
  }
}
