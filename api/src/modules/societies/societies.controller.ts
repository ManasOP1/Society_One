import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Role, SocietyStatus } from '../../common/types/roles';
import {
  CurrentUser,
  Roles,
  type AuthUser,
} from '../../common/decorators/auth.decorators';
import { RolesGuard, TenantGuard } from '../../common/guards/rbac.guards';
import { SocietiesService } from './societies.service';

const CreateSocietySchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),
  address: z.string().min(3),
  registrationNo: z.string().optional(),
  panNumber: z.string().optional(),
  wings: z.array(z.string()).optional(),
  totalFlats: z.number().int().nonnegative().optional(),
});
class CreateSocietyDto extends createZodDto(CreateSocietySchema) {}

const UpdateSocietySchema = CreateSocietySchema.partial().extend({
  status: z.nativeEnum(SocietyStatus).optional(),
  occupiedFlats: z.number().int().nonnegative().optional(),
});
class UpdateSocietyDto extends createZodDto(UpdateSocietySchema) {}

@ApiTags('Societies')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('societies')
export class SocietiesController {
  constructor(private readonly societies: SocietiesService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN)
  list() {
    return this.societies.list();
  }

  @Get('me')
  @Roles(Role.SOCIETY_ADMIN, Role.SUPER_ADMIN)
  me(@CurrentUser() user: AuthUser) {
    return this.societies.getCurrent(user);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN)
  get(@Param('id') id: string) {
    return this.societies.getById(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() body: CreateSocietyDto, @CurrentUser() user: AuthUser) {
    return this.societies.create(body, user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() body: UpdateSocietyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.societies.update(id, body, user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.societies.remove(id, user);
  }
}
