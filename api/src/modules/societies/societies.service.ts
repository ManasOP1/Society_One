import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { SocietyStatus } from '../../common/types/roles';

export type CreateSocietyInput = {
  name: string;
  slug: string;
  address: string;
  registrationNo?: string;
  panNumber?: string;
  wings?: string[];
  totalFlats?: number;
};

export type UpdateSocietyInput = Partial<CreateSocietyInput> & {
  status?: SocietyStatus;
  occupiedFlats?: number;
};

@Injectable()
export class SocietiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    return this.prisma.society.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        wings: true,
        _count: { select: { members: true, flats: true, users: true } },
      },
    });
  }

  async getById(id: string) {
    const society = await this.prisma.society.findFirst({
      where: { id, deletedAt: null },
      include: { settings: true, wings: true },
    });
    if (!society) throw new NotFoundException('Society not found');
    return society;
  }

  async getCurrent(user: AuthUser) {
    if (!user.societyId) {
      throw new BadRequestException('User is not assigned to a society');
    }
    return this.getById(user.societyId);
  }

  async create(input: CreateSocietyInput, actor: AuthUser) {
    const tenantId = await this.resolveTenantIdForCreate(input, actor);

    const existing = await this.prisma.society.findUnique({
      where: { tenantId_slug: { tenantId, slug: input.slug } },
    });
    if (existing) throw new BadRequestException('Slug already in use');

    const society = await this.prisma.society.create({
      data: {
        tenantId,
        name: input.name,
        slug: input.slug,
        address: input.address,
        registrationNo: input.registrationNo,
        panNumber: input.panNumber,
        totalFlats: input.totalFlats ?? 0,
        settings: { create: { tenantId } },
        wings: input.wings?.length
          ? {
              create: input.wings.map((code) => ({
                tenantId,
                code,
              })),
            }
          : undefined,
      },
      include: { settings: true, wings: true },
    });

    await this.audit.log({
      societyId: society.id,
      actorId: actor.id,
      action: 'SOCIETY_CREATED',
      entityType: 'Society',
      entityId: society.id,
      details: `Created society ${society.name}`,
    });

    return society;
  }

  async update(id: string, input: UpdateSocietyInput, actor: AuthUser) {
    const current = await this.getById(id);
    const data: Prisma.SocietyUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.slug !== undefined) data.slug = input.slug;
    if (input.address !== undefined) data.address = input.address;
    if (input.registrationNo !== undefined) data.registrationNo = input.registrationNo;
    if (input.panNumber !== undefined) data.panNumber = input.panNumber;
    if (input.totalFlats !== undefined) data.totalFlats = input.totalFlats;
    if (input.occupiedFlats !== undefined) data.occupiedFlats = input.occupiedFlats;
    if (input.status !== undefined) data.statusCode = input.status;

    if (input.wings !== undefined) {
      const existingCodes = new Set(current.wings.map((w) => w.code));
      const toCreate = input.wings.filter((code) => !existingCodes.has(code));
      if (toCreate.length) {
        data.wings = {
          create: toCreate.map((code) => ({ tenantId: current.tenantId, code })),
        };
      }
    }

    const society = await this.prisma.society.update({
      where: { id },
      data,
      include: { settings: true, wings: true },
    });

    await this.audit.log({
      societyId: society.id,
      actorId: actor.id,
      action: 'SOCIETY_UPDATED',
      entityType: 'Society',
      entityId: society.id,
      details: `Updated society ${society.name}`,
    });

    return society;
  }

  async remove(id: string, actor: AuthUser) {
    const society = await this.getById(id);
    await this.prisma.society.update({
      where: { id },
      data: { deletedAt: new Date(), statusCode: SocietyStatus.INACTIVE },
    });
    await this.audit.log({
      societyId: null,
      actorId: actor.id,
      action: 'SOCIETY_DELETED',
      entityType: 'Society',
      entityId: id,
      details: `Deleted society ${society.name}`,
    });
    return { success: true };
  }

  /** SUPER_ADMIN reuses their own tenant; platform users without one get a fresh tenant. */
  private async resolveTenantIdForCreate(
    input: CreateSocietyInput,
    actor: AuthUser,
  ): Promise<string> {
    if (actor.tenantId) return actor.tenantId;
    const tenant = await this.prisma.tenant.create({
      data: { name: input.name, slug: input.slug },
    });
    return tenant.id;
  }
}
