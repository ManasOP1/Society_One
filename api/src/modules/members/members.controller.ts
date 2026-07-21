import {
  Body,
  Controller,
  Delete,
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
import { Role } from '../../common/types/roles';
import {
  CurrentUser,
  Roles,
  type AuthUser,
} from '../../common/decorators/auth.decorators';
import { RolesGuard, TenantGuard } from '../../common/guards/rbac.guards';
import { resolveSocietyId } from '../../common/utils/tenant.util';
import { BHK_TYPES } from '../../common/types/bhk';
import { MembersService } from './members.service';

const CreateMemberSchema = z.object({
  ownerName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  parking: z.string().optional(),
  wing: z.string().min(1),
  flatNo: z.string().min(1),
  areaSqft: z.number().positive().optional(),
  bhkType: z.enum(BHK_TYPES).optional(),
  maintenanceAmount: z.number().nonnegative().optional(),
  flatId: z.string().optional(),
  isActive: z.boolean().optional(),
});
class CreateMemberDto extends createZodDto(CreateMemberSchema) {}

const UpdateMemberSchema = z.object({
  ownerName: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  parking: z.string().optional(),
  wing: z.string().min(1).optional(),
  flatNo: z.string().min(1).optional(),
  areaSqft: z.number().positive().optional(),
  bhkType: z.enum(BHK_TYPES).optional(),
  maintenanceAmount: z.number().nonnegative().optional(),
  flatId: z.string().optional(),
  isActive: z.boolean().optional(),
});
class UpdateMemberDto extends createZodDto(UpdateMemberSchema) {}

@ApiTags('Members')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  list(
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.members.list(resolveSocietyId(user, societyId), user, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN, Role.RESIDENT)
  get(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.members.getById(resolveSocietyId(user, societyId), id, user);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  create(
    @Body() body: CreateMemberDto,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.members.create(resolveSocietyId(user, societyId), body, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  update(
    @Param('id') id: string,
    @Body() body: UpdateMemberDto,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.members.update(resolveSocietyId(user, societyId), id, body, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.members.remove(resolveSocietyId(user, societyId), id, user);
  }
}
