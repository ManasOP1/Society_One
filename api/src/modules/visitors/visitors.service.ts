import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role, VisitorStatus } from '../../common/types/roles';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export type CreateVisitorInput = {
  name: string;
  flat: string;
  purpose: string;
  vehicle?: string;
  phone?: string;
  expectedTime?: string;
  status?: VisitorStatus;
  memberId?: string;
};

@Injectable()
export class VisitorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(societyId: string, user: AuthUser) {
    const where: Prisma.VisitorWhereInput = { societyId, deletedAt: null };

    if (user.role === Role.RESIDENT) {
      if (!user.memberId) throw new ForbiddenException('No member linked');
      const flatLabel = await this.primaryFlatLabel(user.memberId);
      where.OR = [
        { memberId: user.memberId },
        ...(flatLabel ? [{ flatLabel }] : []),
      ];
    }

    return this.prisma.visitor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, ownerName: true } },
      },
    });
  }

  async create(societyId: string, input: CreateVisitorInput, actor: AuthUser) {
    let memberId = input.memberId;
    if (actor.role === Role.RESIDENT) {
      if (!actor.memberId) throw new ForbiddenException('No member linked');
      memberId = actor.memberId;
    }
    const tenantId = await this.prisma.getSocietyTenantId(societyId);

    const visitor = await this.prisma.visitor.create({
      data: {
        tenantId,
        societyId,
        memberId,
        name: input.name,
        flatLabel: input.flat,
        purpose: input.purpose,
        vehicle: input.vehicle,
        phone: input.phone,
        expectedTime: input.expectedTime,
        statusCode: input.status ?? VisitorStatus.LOGGED,
      },
    });

    await this.audit.log({
      societyId,
      actorId: actor.id,
      action: 'VISITOR_CREATED',
      entityType: 'Visitor',
      entityId: visitor.id,
      details: `${visitor.name} -> ${visitor.flatLabel}`,
    });

    return visitor;
  }

  async remove(societyId: string, id: string, actor: AuthUser) {
    const visitor = await this.prisma.visitor.findFirst({
      where: { id, societyId, deletedAt: null },
    });
    if (!visitor) throw new NotFoundException('Visitor not found');

    if (
      actor.role === Role.RESIDENT &&
      visitor.memberId !== actor.memberId
    ) {
      throw new ForbiddenException('Cannot delete this visitor');
    }

    await this.prisma.visitor.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      societyId,
      actorId: actor.id,
      action: 'VISITOR_DELETED',
      entityType: 'Visitor',
      entityId: id,
    });
    return { success: true };
  }

  private async primaryFlatLabel(memberId: string): Promise<string | null> {
    const memberFlat = await this.prisma.memberFlat.findFirst({
      where: { memberId, deletedAt: null },
      orderBy: { isPrimary: 'desc' },
      include: { flat: { include: { wing: true } } },
    });
    if (!memberFlat) return null;
    return `${memberFlat.flat.wing.code}-${memberFlat.flat.flatNo}`;
  }
}
