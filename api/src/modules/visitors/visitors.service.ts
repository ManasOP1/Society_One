import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { Role, VisitorStatus } from '../../common/types/roles';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SupabaseStorageService } from '../../infrastructure/supabase/supabase-storage.service';
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

export type GateCheckInInput = {
  name: string;
  phone: string;
  visitType: string;
  companyName: string;
  wingCode: string;
  flatNo: string;
  vehicleType: string;
  vehicleNo: string;
  /** data:image/jpeg;base64,... or raw base64 */
  photoBase64: string;
  createdByName?: string;
  deviceId?: string;
};

function serializeVisitor(
  v: Prisma.VisitorGetPayload<{
    include: { member: { select: { id: true; ownerName: true } } };
  }>,
) {
  return {
    id: v.id,
    societyId: v.societyId,
    name: v.name,
    flat: v.flatLabel,
    flatLabel: v.flatLabel,
    flatId: v.flatId,
    wingCode: v.wingCode,
    flatNo: v.flatNo,
    purpose: v.purpose,
    visitType: v.visitType,
    companyName: v.companyName,
    vehicle: v.vehicle,
    vehicleType: v.vehicleType,
    vehicleNo: v.vehicleNo,
    phone: v.phone,
    photoUrl: v.photoUrl,
    passNumber: v.passNumber,
    checkInAt: v.checkInAt?.toISOString() ?? null,
    expectedTime: v.expectedTime,
    status: v.statusCode,
    statusCode: v.statusCode,
    createdByName: v.createdByName,
    deviceId: v.deviceId,
    createdAt: v.createdAt.toISOString(),
    member: v.member,
  };
}

@Injectable()
export class VisitorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: SupabaseStorageService,
    private readonly config: ConfigService,
  ) {}

  async list(societyId: string, user: AuthUser) {
    const where: Prisma.VisitorWhereInput = { societyId, deletedAt: null };

    if (user.role === Role.RESIDENT) {
      if (!user.memberId) throw new ForbiddenException('No member linked');
      const flat = await this.primaryFlat(user.memberId);
      where.OR = [
        { memberId: user.memberId },
        ...(flat?.flatId ? [{ flatId: flat.flatId }] : []),
        ...(flat?.flatLabel ? [{ flatLabel: flat.flatLabel }] : []),
        ...(flat?.wingCode && flat.flatNo
          ? [{ wingCode: flat.wingCode, flatNo: flat.flatNo }]
          : []),
      ];
    }

    const rows = await this.prisma.visitor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        member: { select: { id: true, ownerName: true } },
      },
    });
    return rows.map(serializeVisitor);
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
        createdById: actor.id,
        createdByName: actor.name,
      },
      include: { member: { select: { id: true, ownerName: true } } },
    });

    await this.audit.log({
      societyId,
      actorId: actor.id,
      action: 'VISITOR_CREATED',
      entityType: 'Visitor',
      entityId: visitor.id,
      details: `${visitor.name} -> ${visitor.flatLabel}`,
    });

    return serializeVisitor(visitor);
  }

  async remove(societyId: string, id: string, actor: AuthUser) {
    const visitor = await this.prisma.visitor.findFirst({
      where: { id, societyId, deletedAt: null },
    });
    if (!visitor) throw new NotFoundException('Visitor not found');

    if (actor.role === Role.RESIDENT && visitor.memberId !== actor.memberId) {
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

  /** Ensure society has a stable gate QR token (generate once). */
  async ensureGateQr(societyId: string, actor: AuthUser) {
    if (actor.role === Role.RESIDENT) {
      throw new ForbiddenException('Only admins can manage gate QR');
    }
    const society = await this.prisma.society.findFirst({
      where: { id: societyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        address: true,
        gateQrToken: true,
        gateQrGeneratedAt: true,
      },
    });
    if (!society) throw new NotFoundException('Society not found');

    if (society.gateQrToken) {
      return this.gateQrPayload(society);
    }

    const token = randomBytes(24).toString('base64url');
    const updated = await this.prisma.society.update({
      where: { id: societyId },
      data: {
        gateQrToken: token,
        gateQrGeneratedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        address: true,
        gateQrToken: true,
        gateQrGeneratedAt: true,
      },
    });

    await this.audit.log({
      societyId,
      actorId: actor.id,
      action: 'GATE_QR_GENERATED',
      entityType: 'Society',
      entityId: societyId,
      details: 'Society gate QR token created',
    });

    return this.gateQrPayload(updated);
  }

  async getGateQr(societyId: string, actor: AuthUser) {
    if (actor.role === Role.RESIDENT) {
      throw new ForbiddenException('Only admins can view gate QR');
    }
    const society = await this.prisma.society.findFirst({
      where: { id: societyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        address: true,
        gateQrToken: true,
        gateQrGeneratedAt: true,
      },
    });
    if (!society) throw new NotFoundException('Society not found');
    if (!society.gateQrToken) {
      return this.ensureGateQr(societyId, actor);
    }
    return this.gateQrPayload(society);
  }

  /** Public: resolve gate token → society + wings. */
  async publicGateContext(token: string) {
    const society = await this.resolveGateSociety(token);
    const wings = await this.prisma.wing.findMany({
      where: { societyId: society.id, deletedAt: null },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    });
    return {
      societyId: society.id,
      societyName: society.name,
      address: society.address,
      wings: wings.map((w) => ({
        id: w.id,
        code: w.code,
        name: w.name ?? `${w.code} Wing`,
        label: w.name?.includes('Wing') ? w.name : `${w.code} Wing`,
      })),
    };
  }

  /** Public: flats for a wing under gate token. */
  async publicGateFlats(token: string, wingCode: string) {
    const society = await this.resolveGateSociety(token);
    const wing = await this.prisma.wing.findFirst({
      where: {
        societyId: society.id,
        code: wingCode.trim().toUpperCase(),
        deletedAt: null,
      },
    });
    if (!wing) throw new NotFoundException('Wing not found');

    const flats = await this.prisma.flat.findMany({
      where: { societyId: society.id, wingId: wing.id, deletedAt: null },
      orderBy: { flatNo: 'asc' },
      select: { id: true, flatNo: true },
    });

    return flats.map((f) => ({
      id: f.id,
      flatNo: f.flatNo,
      label: `${wing.code}-${f.flatNo}`,
    }));
  }

  /**
   * Public gate check-in — no approval; writes directly to visitors.
   * Methods: #15 unique flat lookup; #17 write path separate from admin list reads.
   */
  async publicGateCheckIn(token: string, input: GateCheckInInput) {
    const society = await this.resolveGateSociety(token);
    this.validateGateInput(input);

    const wingCode = input.wingCode.trim().toUpperCase();
    const flatNo = input.flatNo.trim();
    const vehicleNo = input.vehicleNo.trim().toUpperCase();
    const phone = input.phone.replace(/\D/g, '');

    const wing = await this.prisma.wing.findFirst({
      where: { societyId: society.id, code: wingCode, deletedAt: null },
    });
    if (!wing) throw new BadRequestException('Invalid wing');

    const flat = await this.prisma.flat.findFirst({
      where: {
        societyId: society.id,
        wingId: wing.id,
        flatNo,
        deletedAt: null,
      },
    });
    if (!flat) throw new BadRequestException('Invalid flat number for wing');

    const primaryMember = await this.prisma.memberFlat.findFirst({
      where: {
        flatId: flat.id,
        societyId: society.id,
        deletedAt: null,
        isPrimary: true,
      },
      select: { memberId: true },
    });

    const photoUrl = await this.uploadVisitorPhoto(
      society.id,
      input.photoBase64,
    );
    const now = new Date();
    const passNumber = await this.nextPassNumber(society.id, now);
    const flatLabel = `${wingCode}-${flatNo}`;
    const purpose = [input.visitType, input.companyName].filter(Boolean).join(' · ');

    const visitor = await this.prisma.visitor.create({
      data: {
        tenantId: society.tenantId,
        societyId: society.id,
        memberId: primaryMember?.memberId ?? null,
        flatId: flat.id,
        name: input.name.trim(),
        phone,
        flatLabel,
        purpose,
        visitType: input.visitType.trim(),
        companyName: input.companyName.trim(),
        wingCode,
        flatNo,
        vehicleType: input.vehicleType.trim(),
        vehicleNo,
        vehicle: `${input.vehicleType.trim()} ${vehicleNo}`.trim(),
        photoUrl,
        passNumber,
        checkInAt: now,
        entryAt: now,
        statusCode: VisitorStatus.INSIDE,
        categoryCode: this.mapCategory(input.visitType),
        createdByName: input.createdByName?.trim() || 'Gate Guard',
        deviceId: input.deviceId?.slice(0, 128) || null,
        expectedTime: now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
      include: { member: { select: { id: true, ownerName: true } } },
    });

    void this.audit
      .log({
        societyId: society.id,
        action: 'VISITOR_GATE_CHECKIN',
        entityType: 'Visitor',
        entityId: visitor.id,
        details: `${visitor.name} → ${flatLabel} (${passNumber})`,
      })
      .catch(() => undefined);

    return {
      ...serializeVisitor(visitor),
      societyName: society.name,
      message: 'Visitor Registered Successfully',
    };
  }

  private gateQrPayload(society: {
    id: string;
    name: string;
    address: string;
    gateQrToken: string | null;
    gateQrGeneratedAt: Date | null;
  }) {
    const adminPublic =
      this.config.get<string>('ADMIN_PUBLIC_URL') ||
      this.config.get<string>('APP_PUBLIC_URL') ||
      'http://localhost:3000';
    const token = society.gateQrToken!;
    const gateUrl = `${adminPublic.replace(/\/$/, '')}/gate/${token}`;
    return {
      societyId: society.id,
      societyName: society.name,
      address: society.address,
      token,
      gateUrl,
      generatedAt: society.gateQrGeneratedAt?.toISOString() ?? null,
    };
  }

  private async resolveGateSociety(token: string) {
    if (!token || token.length < 16) {
      throw new NotFoundException('Invalid gate QR');
    }
    const society = await this.prisma.society.findFirst({
      where: {
        gateQrToken: token,
        deletedAt: null,
        statusCode: 'ACTIVE',
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        address: true,
      },
    });
    if (!society) throw new NotFoundException('Gate QR not found or inactive');
    return society;
  }

  private validateGateInput(input: GateCheckInInput) {
    if (!input.name?.trim()) throw new BadRequestException('Visitor name is required');
    const phone = (input.phone || '').replace(/\D/g, '');
    if (!/^\d{10}$/.test(phone)) {
      throw new BadRequestException('Mobile number must be exactly 10 digits');
    }
    if (!input.visitType?.trim()) throw new BadRequestException('Visit type is required');
    if (!input.companyName?.trim()) throw new BadRequestException('Company name is required');
    if (!input.wingCode?.trim()) throw new BadRequestException('Wing is required');
    if (!input.flatNo?.trim()) throw new BadRequestException('Flat number is required');
    if (!input.vehicleType?.trim()) throw new BadRequestException('Vehicle type is required');
    if (!input.vehicleNo?.trim()) throw new BadRequestException('Vehicle number is required');
    if (!input.photoBase64?.trim()) throw new BadRequestException('Visitor photo is required');
  }

  private async uploadVisitorPhoto(societyId: string, photoBase64: string) {
    const match = photoBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    const contentType = match?.[1] ?? 'image/jpeg';
    const raw = match?.[2] ?? photoBase64;
    let buffer: Buffer;
    try {
      buffer = Buffer.from(raw, 'base64');
    } catch {
      throw new BadRequestException('Invalid photo data');
    }
    if (buffer.length < 500) throw new BadRequestException('Photo too small');
    if (buffer.length > 6_000_000) throw new BadRequestException('Photo too large (max 6MB)');

    try {
      const uploaded = await this.storage.upload({
        societyId,
        folder: 'visitor-photos',
        fileName: `checkin.${contentType.includes('png') ? 'png' : 'jpg'}`,
        body: buffer,
        contentType,
      });
      return uploaded.url;
    } catch {
      // Local / misconfigured bucket: keep a compact data URL so check-in still works.
      if (buffer.length <= 180_000) {
        return `data:${contentType};base64,${buffer.toString('base64')}`;
      }
      throw new BadRequestException(
        'Could not upload visitor photo. Check Supabase storage, or use a smaller photo.',
      );
    }
  }

  private async nextPassNumber(societyId: string, at: Date) {
    const day = at.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `VP-${day}-`;
    const last = await this.prisma.visitor.findFirst({
      where: { societyId, passNumber: { startsWith: prefix } },
      orderBy: { passNumber: 'desc' },
      select: { passNumber: true },
    });
    const seq = last?.passNumber
      ? Number(last.passNumber.slice(prefix.length)) || 0
      : 0;
    return `${prefix}${String(seq + 1).padStart(4, '0')}`;
  }

  private mapCategory(visitType: string): string {
    const t = visitType.toLowerCase();
    if (/(maid|driver|housekeeping|maintenance|electrician|plumber|technician)/.test(t)) {
      return 'STAFF';
    }
    if (/(uber|ola|rapido|porter)/.test(t)) return 'CAB';
    if (/(delivery|courier|amazon|flipkart|zomato|swiggy|grocery|shopping|gas|milk|newspaper)/.test(t)) {
      return 'DELIVERY';
    }
    if (/(guest|friend|relative)/.test(t)) return 'GUEST';
    return 'OTHER';
  }

  private async primaryFlat(memberId: string) {
    const memberFlat = await this.prisma.memberFlat.findFirst({
      where: { memberId, deletedAt: null },
      orderBy: { isPrimary: 'desc' },
      include: { flat: { include: { wing: true } } },
    });
    if (!memberFlat) return null;
    return {
      flatId: memberFlat.flatId,
      wingCode: memberFlat.flat.wing.code,
      flatNo: memberFlat.flat.flatNo,
      flatLabel: `${memberFlat.flat.wing.code}-${memberFlat.flat.flatNo}`,
    };
  }
}
