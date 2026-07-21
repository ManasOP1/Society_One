import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators/auth.decorators';

export type CreateFlatInput = {
  wing: string;
  flatNo: string;
  floor?: number;
  areaSqft?: number;
  parking?: string;
  isOccupied?: boolean;
};

export type UpdateFlatInput = Partial<CreateFlatInput>;

function serializeFlat<
  T extends { wing?: { code: string; name: string | null } | null },
>(flat: T) {
  return { ...flat, wingCode: flat.wing?.code ?? null };
}

@Injectable()
export class FlatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(societyId: string) {
    const flats = await this.prisma.flat.findMany({
      where: { societyId, deletedAt: null },
      orderBy: [{ wing: { code: 'asc' } }, { flatNo: 'asc' }],
      include: { wing: true, _count: { select: { memberFlats: true } } },
    });
    return flats.map(serializeFlat);
  }

  async getById(societyId: string, id: string) {
    const flat = await this.prisma.flat.findFirst({
      where: { id, societyId, deletedAt: null },
      include: {
        wing: true,
        memberFlats: { where: { deletedAt: null }, include: { member: true } },
      },
    });
    if (!flat) throw new NotFoundException('Flat not found');
    return serializeFlat(flat);
  }

  async create(societyId: string, input: CreateFlatInput, actor: AuthUser) {
    const tenantId = await this.prisma.getSocietyTenantId(societyId);
    const wing = await this.findOrCreateWing(societyId, tenantId, input.wing);

    const flat = await this.prisma.flat.create({
      data: {
        tenantId,
        societyId,
        wingId: wing.id,
        flatNo: input.flatNo,
        floor: input.floor,
        areaSqft: input.areaSqft,
        parking: input.parking,
        isOccupied: input.isOccupied ?? false,
      },
      include: { wing: true },
    });
    await this.audit.log({
      societyId,
      actorId: actor.id,
      action: 'FLAT_CREATED',
      entityType: 'Flat',
      entityId: flat.id,
      details: `${wing.code}-${flat.flatNo}`,
    });
    return serializeFlat(flat);
  }

  async update(
    societyId: string,
    id: string,
    input: UpdateFlatInput,
    actor: AuthUser,
  ) {
    await this.getById(societyId, id);
    const data: Prisma.FlatUpdateInput = {};
    if (input.wing !== undefined) {
      const tenantId = await this.prisma.getSocietyTenantId(societyId);
      const wing = await this.findOrCreateWing(societyId, tenantId, input.wing);
      data.wing = { connect: { id: wing.id } };
    }
    if (input.flatNo !== undefined) data.flatNo = input.flatNo;
    if (input.floor !== undefined) data.floor = input.floor;
    if (input.areaSqft !== undefined) data.areaSqft = input.areaSqft;
    if (input.parking !== undefined) data.parking = input.parking;
    if (input.isOccupied !== undefined) data.isOccupied = input.isOccupied;

    const flat = await this.prisma.flat.update({
      where: { id },
      data,
      include: { wing: true },
    });
    await this.audit.log({
      societyId,
      actorId: actor.id,
      action: 'FLAT_UPDATED',
      entityType: 'Flat',
      entityId: flat.id,
    });
    return serializeFlat(flat);
  }

  async remove(societyId: string, id: string, actor: AuthUser) {
    await this.getById(societyId, id);
    await this.prisma.flat.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      societyId,
      actorId: actor.id,
      action: 'FLAT_DELETED',
      entityType: 'Flat',
      entityId: id,
    });
    return { success: true };
  }

  private async findOrCreateWing(
    societyId: string,
    tenantId: string,
    code: string,
  ) {
    const existing = await this.prisma.wing.findUnique({
      where: { societyId_code: { societyId, code } },
    });
    if (existing) return existing;
    return this.prisma.wing.create({ data: { tenantId, societyId, code } });
  }
}
