import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType } from '../../common/types/roles';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export type RegisterDocumentInput = {
  type: DocumentType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  url: string;
  entityType?: string;
  entityId?: string;
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(
    societyId: string,
    filters?: { type?: DocumentType; entityType?: string; entityId?: string },
  ) {
    return this.prisma.document.findMany({
      where: {
        societyId,
        deletedAt: null,
        ...(filters?.type ? { typeCode: filters.type } : {}),
        ...(filters?.entityType ? { entityType: filters.entityType } : {}),
        ...(filters?.entityId ? { entityId: filters.entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(societyId: string, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, societyId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  /** Persist metadata after file has been uploaded to object storage. */
  async registerDocument(
    societyId: string,
    input: RegisterDocumentInput,
    actor?: AuthUser,
  ) {
    const tenantId = await this.prisma.getSocietyTenantId(societyId);
    const doc = await this.prisma.document.create({
      data: {
        tenantId,
        societyId,
        typeCode: input.type,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storagePath: input.storagePath,
        url: input.url,
        entityType: input.entityType,
        entityId: input.entityId,
        uploadedBy: actor?.id,
      },
    });

    if (actor) {
      await this.audit.log({
        societyId,
        actorId: actor.id,
        action: 'DOCUMENT_REGISTERED',
        entityType: 'Document',
        entityId: doc.id,
        details: `${doc.typeCode} ${doc.fileName}`,
      });
    }

    return doc;
  }
}
