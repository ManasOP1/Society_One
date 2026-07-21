import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  ComplaintPriority,
  ComplaintStatus,
  Role,
} from '../../common/types/roles';
import {
  CurrentUser,
  Roles,
  type AuthUser,
} from '../../common/decorators/auth.decorators';
import { RolesGuard, TenantGuard } from '../../common/guards/rbac.guards';
import { resolveSocietyId } from '../../common/utils/tenant.util';
import { ComplaintsService } from './complaints.service';

const CreateComplaintSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().optional(),
  priority: z.nativeEnum(ComplaintPriority).optional(),
  memberId: z.string().optional(),
});
class CreateComplaintDto extends createZodDto(CreateComplaintSchema) {}

const UpdateComplaintStatusSchema = z.object({
  status: z.nativeEnum(ComplaintStatus),
  priority: z.nativeEnum(ComplaintPriority).optional(),
});
class UpdateComplaintStatusDto extends createZodDto(
  UpdateComplaintStatusSchema,
) {}

@ApiTags('Complaints')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaints: ComplaintsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN, Role.RESIDENT)
  list(
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
    @Query('status') status?: ComplaintStatus,
  ) {
    return this.complaints.list(
      resolveSocietyId(user, societyId),
      user,
      status,
    );
  }

  @Post()
  @Roles(Role.RESIDENT, Role.SOCIETY_ADMIN, Role.SUPER_ADMIN)
  create(
    @Body() body: CreateComplaintDto,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.complaints.create(
      resolveSocietyId(user, societyId),
      body,
      user,
    );
  }

  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateComplaintStatusDto,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.complaints.updateStatus(
      resolveSocietyId(user, societyId),
      id,
      body,
      user,
    );
  }
}
