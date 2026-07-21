import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type AuditLogInput = {
  societyId?: string | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  /** Must be a UUID (audit_logs.entity_id is uuid); falls back to societyId when unavailable. */
  entityId: string;
  details?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    const tenantId = input.societyId
      ? await this.prisma.getSocietyTenantId(input.societyId).catch(() => null)
      : null;
    const entityId = UUID_RE.test(input.entityId)
      ? input.entityId
      : input.societyId ?? input.actorId ?? undefined;

    return this.prisma.auditLog.create({
      data: {
        tenantId,
        societyId: input.societyId ?? null,
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: entityId ?? '00000000-0000-0000-0000-000000000000',
        details: input.details ?? null,
        metadata: input.metadata ?? undefined,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  async list(societyId: string | null, opts?: { take?: number; skip?: number }) {
    const take = opts?.take ?? 50;
    const skip = opts?.skip ?? 0;
    const rows = await this.prisma.auditLog.findMany({
      where: societyId ? { societyId } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    // AuditLog has no FK relation to User (actor may be null / deleted); hydrate manually.
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((id): id is string => !!id))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    return rows.map((row) => ({
      ...row,
      actor: row.actorId ? actorMap.get(row.actorId) ?? null : null,
    }));
  }
}
