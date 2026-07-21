import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { DocumentType, Role } from '../../common/types/roles';
import {
  CurrentUser,
  Roles,
  type AuthUser,
} from '../../common/decorators/auth.decorators';
import { RolesGuard, TenantGuard } from '../../common/guards/rbac.guards';
import { resolveSocietyId } from '../../common/utils/tenant.util';
import { DocumentsService } from './documents.service';

const RegisterDocumentSchema = z.object({
  type: z.nativeEnum(DocumentType),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  storagePath: z.string().min(1),
  url: z.string().url(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});
class RegisterDocumentDto extends createZodDto(RegisterDocumentSchema) {}

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(RolesGuard, TenantGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN, Role.RESIDENT)
  list(
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
    @Query('type') type?: DocumentType,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.documents.list(resolveSocietyId(user, societyId), {
      type,
      entityType,
      entityId,
    });
  }

  @Post('register')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN)
  register(
    @Body() body: RegisterDocumentDto,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.documents.registerDocument(
      resolveSocietyId(user, societyId),
      body,
      user,
    );
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.SOCIETY_ADMIN, Role.RESIDENT)
  get(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Query('societyId') societyId?: string,
  ) {
    return this.documents.getById(resolveSocietyId(user, societyId), id);
  }
}
