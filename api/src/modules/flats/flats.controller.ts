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
import { FlatsService } from './flats.service';

const CreateFlatSchema = z.object({
  wing: z.string().min(1),
  flatNo: z.string().min(1),
  floor: z.number().int().optional(),
  areaSqft: z.number().positive().optional(),
  parking: z.string().optional(),
  isOccupied: z.boolean().optional(),
});
class CreateFlatDto extends createZodDto(CreateFlatSchema) {}

const UpdateFlatSchema = CreateFlatSchema.partial();
class UpdateFlatDto extends createZodDto(UpdateFlatSchema) {}

@ApiTags('Flats')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('flats')
export class FlatsController {
  constructor(private readonly flats: FlatsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  list(@CurrentUser() user: AuthUser, @Query('societyId') societyId?: string) {
    return this.flats.list(resolveSocietyId(user, societyId));
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  get(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.flats.getById(resolveSocietyId(user, societyId), id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  create(
    @Body() body: CreateFlatDto,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.flats.create(resolveSocietyId(user, societyId), body, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  update(
    @Param('id') id: string,
    @Body() body: UpdateFlatDto,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.flats.update(resolveSocietyId(user, societyId), id, body, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.flats.remove(resolveSocietyId(user, societyId), id, user);
  }
}
