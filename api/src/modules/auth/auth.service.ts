import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { Role, pickPrimaryRole } from '../../common/types/roles';
import { readCache } from '../../common/utils/ttl-cache';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthUser } from '../../common/decorators/auth.decorators';

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  tenantId: string | null;
  societyId: string | null;
  memberId: string | null;
  name: string;
};

type UserWithRoles = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  passwordHash: string;
  tenantId: string | null;
  societyId: string | null;
  memberId: string | null;
  isActive: boolean;
  roles: { roleCode: string }[];
};

const USER_WITH_ROLES_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  passwordHash: true,
  tenantId: true,
  societyId: true,
  memberId: true,
  isActive: true,
  roles: {
    where: { deletedAt: null },
    select: { roleCode: true },
  },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      select: USER_WITH_ROLES_SELECT,
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    void this.prisma.user
      .update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })
      .catch(() => undefined);

    return this.issueTokens(user);
  }

  /** Societies available on the mobile login screen (no auth required). */
  async listSocietiesForLogin() {
    const cacheKey = 'login:societies';
    const cached = readCache.get<{ id: string; name: string }[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.prisma.society.findMany({
      where: { deletedAt: null, statusCode: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    readCache.set(cacheKey, rows, 5 * 60_000);
    return rows;
  }

  /** Wings for a selected society — used to populate the login picker. */
  async listWingsForLogin(societyId: string) {
    const cacheKey = `login:wings:${societyId}`;
    const cached = readCache.get<{ id: string; code: string; name: string }[]>(cacheKey);
    if (cached) return cached;

    const society = await this.prisma.society.findFirst({
      where: { id: societyId, deletedAt: null, statusCode: 'ACTIVE' },
      select: { id: true },
    });
    if (!society) throw new UnauthorizedException('Invalid society');

    const rows = await this.prisma.wing.findMany({
      where: { societyId, deletedAt: null },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    });
    readCache.set(cacheKey, rows, 5 * 60_000);
    return rows;
  }

  /**
   * Resident mobile login — society + wing + flat + password must all match
   * the member's primary flat and linked user account.
   */
  async loginResident(
    societyId: string,
    wing: string,
    flatNo: string,
    password: string,
  ) {
    const society = await this.prisma.society.findFirst({
      where: { id: societyId, deletedAt: null, statusCode: 'ACTIVE' },
      select: { id: true },
    });
    if (!society) throw new UnauthorizedException('Invalid credentials');

    const memberFlat = await this.prisma.memberFlat.findFirst({
      where: {
        deletedAt: null,
        flat: {
          societyId,
          deletedAt: null,
          flatNo: { equals: flatNo.trim(), mode: 'insensitive' },
          wing: {
            societyId,
            deletedAt: null,
            code: { equals: wing.trim(), mode: 'insensitive' },
          },
        },
        member: {
          societyId,
          deletedAt: null,
          isActive: true,
          user: { deletedAt: null },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      include: {
        flat: { include: { wing: { select: { code: true } } } },
        member: {
          include: {
            user: { select: USER_WITH_ROLES_SELECT },
          },
        },
      },
    });

    const user = memberFlat?.member?.user;
    if (!user || !user.isActive || user.societyId !== societyId) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    void this.prisma.user
      .update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })
      .catch(() => undefined);

    const primaryFlat = memberFlat.flat
      ? { wing: memberFlat.flat.wing.code, flatNo: memberFlat.flat.flatNo }
      : null;
    return this.issueTokens(user, primaryFlat);
  }

  async refresh(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: { select: USER_WITH_ROLES_SELECT } },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (!stored.user.isActive) throw new UnauthorizedException('User inactive');

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user);
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash: this.hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return;
    }
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Request a password reset link/token for the given email. Always returns success. */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, isActive: true, deletedAt: true },
    });
    if (!user || !user.isActive || user.deletedAt) {
      return { success: true as const };
    }

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(rawToken),
        expiresAt,
      },
    });

    const appUrl = this.config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:4000';
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    if (this.config.get<string>('NODE_ENV') === 'development') {
      // eslint-disable-next-line no-console
      console.info(`[SocietyOne] Password reset for ${user.email}: ${resetUrl}`);
    }

    await this.sendResetEmail(user.email, resetUrl).catch(() => undefined);

    return { success: true as const };
  }

  /** Set a new password using a valid reset token. */
  async resetPassword(token: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const hash = this.hashToken(token);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hash },
      include: { user: { select: { id: true, isActive: true, deletedAt: true } } },
    });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    if (!stored.user.isActive || stored.user.deletedAt) {
      throw new BadRequestException('Account is inactive');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { success: true as const };
  }

  private async sendResetEmail(to: string, resetUrl: string) {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) return;

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT') ?? 587,
      secure: false,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });

    await transporter.sendMail({
      from: this.config.get<string>('SMTP_FROM') ?? 'noreply@societyone.app',
      to,
      subject: 'Reset your SocietyOne password',
      text: `Use this link to reset your password (valid for 1 hour):\n\n${resetUrl}`,
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        tenantId: true,
        societyId: true,
        memberId: true,
        isActive: true,
        roles: { where: { deletedAt: null }, select: { roleCode: true } },
      },
    });
    if (!user) throw new UnauthorizedException();

    const role = pickPrimaryRole(user.roles.map((r) => r.roleCode));
    const primaryFlat = await this.resolvePrimaryFlat(user.memberId);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role,
      societyId: user.societyId,
      memberId: user.memberId,
      isActive: user.isActive,
      wing: primaryFlat?.wing ?? null,
      flatNo: primaryFlat?.flatNo ?? null,
    };
  }

  /** Mobile clients need wing/flat alongside the JWT claims — read from the member's primary flat. */
  private async resolvePrimaryFlat(
    memberId: string | null,
  ): Promise<{ wing: string; flatNo: string } | null> {
    if (!memberId) return null;
    const memberFlat = await this.prisma.memberFlat.findFirst({
      where: { memberId, deletedAt: null },
      orderBy: { isPrimary: 'desc' },
      include: { flat: { include: { wing: true } } },
    });
    if (!memberFlat) return null;
    return { wing: memberFlat.flat.wing.code, flatNo: memberFlat.flat.flatNo };
  }

  async registerSocietyAdmin(input: {
    tenantId: string;
    societyId: string;
    email: string;
    password: string;
    name: string;
    phone?: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        phone: input.phone,
        tenantId: input.tenantId,
        societyId: input.societyId,
        roles: {
          create: {
            roleCode: Role.SOCIETY_ADMIN,
            tenantId: input.tenantId,
            societyId: input.societyId,
          },
        },
      },
      select: { id: true, email: true, name: true, societyId: true },
    });
    return { ...user, role: Role.SOCIETY_ADMIN };
  }

  toAuthUser(payload: JwtPayload): AuthUser {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      societyId: payload.societyId,
      memberId: payload.memberId,
      name: payload.name,
    };
  }

  private async issueTokens(
    user: UserWithRoles,
    knownPrimaryFlat?: { wing: string; flatNo: string } | null,
  ) {
    const role = pickPrimaryRole(user.roles.map((r) => r.roleCode));
    const primaryFlat =
      knownPrimaryFlat !== undefined
        ? knownPrimaryFlat
        : await this.resolvePrimaryFlat(user.memberId);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role,
      tenantId: user.tenantId,
      societyId: user.societyId,
      memberId: user.memberId,
      name: user.name,
    };

    const accessToken = await this.jwt.signAsync(payload as Record<string, unknown>, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: (this.config.get<string>('JWT_ACCESS_TTL') ?? '15m') as `${number}m`,
    });

    const refreshToken = randomBytes(48).toString('hex');
    const ttl = this.config.get<string>('JWT_REFRESH_TTL') ?? '7d';
    const expiresAt = this.parseTtlDate(ttl);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        societyId: user.societyId,
        memberId: user.memberId,
        phone: user.phone,
        wing: primaryFlat?.wing ?? null,
        flatNo: primaryFlat?.flatNo ?? null,
      },
    };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseTtlDate(ttl: string): Date {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    const now = Date.now();
    if (!match) return new Date(now + 7 * 24 * 3600 * 1000);
    const n = Number(match[1]);
    const unit = match[2];
    const ms =
      unit === 's' ? n * 1000 :
      unit === 'm' ? n * 60_000 :
      unit === 'h' ? n * 3_600_000 :
      n * 86_400_000;
    return new Date(now + ms);
  }
}
