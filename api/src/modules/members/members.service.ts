import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Role } from '../../common/types/roles';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BhkType, isBhkType } from '../../common/types/bhk';
import {
  buildPaginationMeta,
  parsePagination,
  wantsPagination,
  type PaginatedResult,
} from '../../common/utils/pagination.util';
import { activeOnly } from '../../common/utils/prisma-active.util';
import { toNumber } from '../../common/utils/decimal.util';

export type CreateMemberInput = {
  ownerName: string;
  phone?: string;
  email: string;
  /** Society admin sets the resident's app login password. */
  password: string;
  parking?: string;
  wing: string;
  flatNo: string;
  areaSqft?: number;
  bhkType?: BhkType;
  maintenanceAmount?: number;
  flatId?: string;
  isActive?: boolean;
};

export type UpdateMemberInput = {
  ownerName?: string;
  phone?: string;
  email?: string;
  /** When set, resets the linked resident login password. */
  password?: string;
  parking?: string;
  wing?: string;
  flatNo?: string;
  areaSqft?: number;
  bhkType?: BhkType;
  maintenanceAmount?: number;
  flatId?: string;
  isActive?: boolean;
};

const MEMBER_INCLUDE = {
  memberFlats: {
    where: { deletedAt: null },
    orderBy: { isPrimary: 'desc' as const },
    include: { flat: { include: { wing: true } } },
  },
  user: {
    select: {
      id: true,
      email: true,
      isActive: true,
      roles: { where: { deletedAt: null }, select: { roleCode: true } },
    },
  },
} satisfies Prisma.MemberInclude;

type MemberWithFlats = Prisma.MemberGetPayload<{ include: typeof MEMBER_INCLUDE }>;
type Tx = Prisma.TransactionClient;

function serializeMember(member: MemberWithFlats) {
  const primary = member.memberFlats[0];
  const { memberFlats, user, tenantId: _tenantId, ...rest } = member;
  return {
    ...rest,
    wing: primary?.flat.wing.code ?? null,
    flatNo: primary?.flat.flatNo ?? null,
    flatId: primary?.flat.id ?? null,
    parking: primary?.flat.parking ?? null,
    areaSqft: primary?.flat.areaSqft ?? null,
    bhkType: primary?.flat.bhkType ?? null,
    maintenanceAmount:
      primary?.flat.maintenanceAmount != null
        ? toNumber(primary.flat.maintenanceAmount)
        : null,
    hasAppLogin: !!user,
    loginEmail: user?.email ?? member.email ?? null,
    user: user
      ? { id: user.id, email: user.email, roles: user.roles.map((r) => r.roleCode) }
      : null,
  };
}

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    societyId: string,
    user: AuthUser,
    opts?: { page?: number; limit?: number },
  ) {
    if (user.role === Role.RESIDENT) {
      throw new ForbiddenException('Residents cannot list all members');
    }
    const where = { societyId, ...activeOnly };

    if (wantsPagination(opts)) {
      const { skip, take, page, limit } = parsePagination(opts);
      const [total, rows] = await this.prisma.$transaction([
        this.prisma.member.count({ where }),
        this.prisma.member.findMany({
          where,
          orderBy: { ownerName: 'asc' },
          skip,
          take,
          include: MEMBER_INCLUDE,
        }),
      ]);
      const result: PaginatedResult<ReturnType<typeof serializeMember>> = {
        data: rows.map(serializeMember),
        meta: buildPaginationMeta(total, page, limit),
      };
      return result;
    }

    const rows = await this.prisma.member.findMany({
      where,
      orderBy: { ownerName: 'asc' },
      include: MEMBER_INCLUDE,
    });
    return rows.map(serializeMember);
  }

  async getById(societyId: string, id: string, user: AuthUser) {
    const member = await this.prisma.member.findFirst({
      where: { id, societyId, deletedAt: null },
      include: MEMBER_INCLUDE,
    });
    if (!member) throw new NotFoundException('Member not found');
    if (user.role === Role.RESIDENT && user.memberId !== member.id) {
      throw new ForbiddenException('Cannot access other members');
    }
    return serializeMember(member);
  }

  async create(societyId: string, input: CreateMemberInput, actor: AuthUser) {
    const email = input.email.trim().toLowerCase();
    if (!email) throw new BadRequestException('Email is required for app login');
    if (!input.password || input.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const tenantId = await this.prisma.getSocietyTenantId(societyId);
    const flat = await this.resolveFlat(societyId, tenantId, input);
    const passwordHash = await bcrypt.hash(input.password, 12);

    const member = await this.prisma.$transaction(async (tx) => {
      const created = await tx.member.create({
        data: {
          tenantId,
          societyId,
          ownerName: input.ownerName,
          phone: input.phone,
          email,
          isActive: input.isActive ?? true,
          memberFlats: flat
            ? {
                create: {
                  tenantId,
                  societyId,
                  flatId: flat.id,
                  relation: 'OWNER',
                  isPrimary: true,
                },
              }
            : undefined,
        },
        include: MEMBER_INCLUDE,
      });

      await this.provisionResidentLogin(tx, {
        tenantId,
        societyId,
        memberId: created.id,
        email,
        passwordHash,
        name: input.ownerName,
        phone: input.phone,
      });

      return tx.member.findFirstOrThrow({
        where: { id: created.id },
        include: MEMBER_INCLUDE,
      });
    });

    await this.audit.log({
      societyId,
      actorId: actor.id,
      action: 'MEMBER_CREATED',
      entityType: 'Member',
      entityId: member.id,
      details: `${member.ownerName} ${input.wing}-${input.flatNo} (app login provisioned)`,
    });
    return serializeMember(member);
  }

  async update(
    societyId: string,
    id: string,
    input: UpdateMemberInput,
    actor: AuthUser,
  ) {
    const existing = await this.getById(societyId, id, actor);
    const tenantId = await this.prisma.getSocietyTenantId(societyId);

    const data: Prisma.MemberUpdateInput = {};
    if (input.ownerName !== undefined) data.ownerName = input.ownerName;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.email !== undefined) data.email = input.email.toLowerCase();
    if (input.isActive !== undefined) data.isActive = input.isActive;

    if (input.email) {
      const clash = await this.prisma.user.findFirst({
        where: {
          email: input.email.toLowerCase(),
          NOT: { memberId: id },
        },
      });
      if (clash) throw new ConflictException('Email already used by another account');
    }

    await this.prisma.member.update({ where: { id }, data });

    if (input.wing !== undefined || input.flatNo !== undefined || input.flatId !== undefined) {
      const flat = await this.resolveFlat(societyId, tenantId, input as CreateMemberInput);
      if (flat) {
        const primary = await this.prisma.memberFlat.findFirst({
          where: { memberId: id, isPrimary: true, deletedAt: null },
        });
        if (primary) {
          await this.prisma.memberFlat.update({
            where: { id: primary.id },
            data: { flatId: flat.id },
          });
        } else {
          await this.prisma.memberFlat.create({
            data: {
              tenantId,
              societyId,
              memberId: id,
              flatId: flat.id,
              relation: 'OWNER',
              isPrimary: true,
            },
          });
        }
      }
    } else if (
      input.bhkType !== undefined ||
      input.maintenanceAmount !== undefined ||
      input.parking !== undefined ||
      input.areaSqft !== undefined
    ) {
      await this.updatePrimaryFlat(societyId, tenantId, id, input);
    }

    if (input.password || input.email) {
      const loginEmail = (input.email ?? existing.loginEmail ?? existing.email)?.toLowerCase();
      if (!loginEmail) {
        throw new BadRequestException('Email is required to manage app login');
      }
      await this.prisma.$transaction(async (tx) => {
        const linked = await tx.user.findFirst({ where: { memberId: id } });
        if (input.password) {
          const passwordHash = await bcrypt.hash(input.password, 12);
          if (linked) {
            await tx.user.update({
              where: { id: linked.id },
              data: {
                email: loginEmail,
                passwordHash,
                name: input.ownerName ?? undefined,
                phone: input.phone ?? undefined,
                isActive: input.isActive ?? true,
              },
            });
          } else {
            await this.provisionResidentLogin(tx, {
              tenantId,
              societyId,
              memberId: id,
              email: loginEmail,
              passwordHash,
              name: input.ownerName ?? existing.ownerName,
              phone: input.phone ?? existing.phone ?? undefined,
            });
          }
        } else if (linked && input.email) {
          await tx.user.update({
            where: { id: linked.id },
            data: { email: loginEmail },
          });
        }
      });
    }

    await this.audit.log({
      societyId,
      actorId: actor.id,
      action: 'MEMBER_UPDATED',
      entityType: 'Member',
      entityId: id,
      details: `Updated ${input.ownerName ?? existing.ownerName}`,
    });
    return this.getById(societyId, id, actor);
  }

  async remove(societyId: string, id: string, actor: AuthUser) {
    await this.getById(societyId, id, actor);
    await this.prisma.$transaction(async (tx) => {
      await tx.member.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      await tx.user.updateMany({
        where: { memberId: id },
        data: { isActive: false, deletedAt: new Date() },
      });
    });
    await this.audit.log({
      societyId,
      actorId: actor.id,
      action: 'MEMBER_DELETED',
      entityType: 'Member',
      entityId: id,
    });
    return { success: true };
  }

  private async provisionResidentLogin(
    tx: Tx,
    input: {
      tenantId: string;
      societyId: string;
      memberId: string;
      email: string;
      passwordHash: string;
      name: string;
      phone?: string;
    },
  ) {
    const user = await tx.user.create({
      data: {
        tenantId: input.tenantId,
        societyId: input.societyId,
        memberId: input.memberId,
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
        phone: input.phone,
        isActive: true,
        roles: {
          create: {
            tenantId: input.tenantId,
            societyId: input.societyId,
            roleCode: Role.RESIDENT,
          },
        },
      },
    });
    return user;
  }

  private async updatePrimaryFlat(
    societyId: string,
    tenantId: string,
    memberId: string,
    input: Pick<
      UpdateMemberInput,
      'bhkType' | 'maintenanceAmount' | 'parking' | 'areaSqft' | 'wing' | 'flatNo'
    >,
  ) {
    const primary = await this.prisma.memberFlat.findFirst({
      where: { memberId, isPrimary: true, deletedAt: null },
      include: { flat: true },
    });
    if (!primary?.flat) return;

    await this.prisma.flat.update({
      where: { id: primary.flat.id },
      data: {
        areaSqft: input.areaSqft ?? undefined,
        parking: input.parking ?? undefined,
        bhkType: input.bhkType ?? undefined,
        maintenanceAmount: input.maintenanceAmount ?? undefined,
      },
    });
  }

  private async resolveFlat(
    societyId: string,
    tenantId: string,
    input: Pick<
      CreateMemberInput,
      'flatId' | 'wing' | 'flatNo' | 'areaSqft' | 'parking' | 'bhkType' | 'maintenanceAmount'
    >,
  ) {
    if (input.bhkType && !isBhkType(input.bhkType)) {
      throw new BadRequestException('bhkType must be ONE_BHK, TWO_BHK, or THREE_BHK');
    }
    if (input.flatId) {
      const flat = await this.prisma.flat.findFirst({
        where: { id: input.flatId, societyId },
      });
      if (!flat) throw new NotFoundException('Flat not found');
      return flat;
    }
    if (!input.wing || !input.flatNo) return null;

    let wing = await this.prisma.wing.findUnique({
      where: { societyId_code: { societyId, code: input.wing } },
    });
    if (!wing) {
      wing = await this.prisma.wing.create({
        data: { tenantId, societyId, code: input.wing },
      });
    }

    let flat = await this.prisma.flat.findUnique({
      where: { societyId_wingId_flatNo: { societyId, wingId: wing.id, flatNo: input.flatNo } },
    });
    if (!flat) {
      flat = await this.prisma.flat.create({
        data: {
          tenantId,
          societyId,
          wingId: wing.id,
          flatNo: input.flatNo,
          areaSqft: input.areaSqft,
          parking: input.parking,
          bhkType: input.bhkType,
          maintenanceAmount: input.maintenanceAmount,
          isOccupied: true,
        },
      });
    } else if (
      input.areaSqft !== undefined ||
      input.parking !== undefined ||
      input.bhkType !== undefined ||
      input.maintenanceAmount !== undefined
    ) {
      flat = await this.prisma.flat.update({
        where: { id: flat.id },
        data: {
          areaSqft: input.areaSqft ?? undefined,
          parking: input.parking ?? undefined,
          bhkType: input.bhkType ?? undefined,
          maintenanceAmount: input.maintenanceAmount ?? undefined,
        },
      });
    }
    return flat;
  }
}
