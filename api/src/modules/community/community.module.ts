import { BadRequestException, Injectable, Module, NotFoundException } from '@nestjs/common';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EventStatus, InvoiceStatus, Role } from '../../common/types/roles';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CurrentUser, Roles, type AuthUser } from '../../common/decorators/auth.decorators';
import { readCache } from '../../common/utils/ttl-cache';

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  private sid(user: AuthUser) {
    if (!user.societyId) throw new BadRequestException('No society scope');
    return user.societyId;
  }

  notices(user: AuthUser) {
    return this.prisma.notice.findMany({
      where: { societyId: this.sid(user), deletedAt: null },
      orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
    });
  }

  async noticeById(user: AuthUser, id: string) {
    const row = await this.prisma.notice.findFirst({
      where: { id, societyId: this.sid(user), deletedAt: null },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  async createNotice(user: AuthUser, data: { title: string; body: string; pinned?: boolean }) {
    const societyId = this.sid(user);
    const tenantId = await this.prisma.getSocietyTenantId(societyId);
    return this.prisma.notice.create({
      data: {
        tenantId,
        societyId,
        title: data.title,
        body: data.body,
        pinned: data.pinned ?? false,
      },
    });
  }

  async updateNotice(
    user: AuthUser,
    id: string,
    data: { title?: string; body?: string; pinned?: boolean },
  ) {
    const societyId = this.sid(user);
    const row = await this.prisma.notice.findFirst({
      where: { id, societyId, deletedAt: null },
    });
    if (!row) throw new NotFoundException();
    return this.prisma.notice.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.pinned !== undefined ? { pinned: data.pinned } : {}),
      },
    });
  }

  async deleteNotice(user: AuthUser, id: string) {
    const societyId = this.sid(user);
    const row = await this.prisma.notice.findFirst({
      where: { id, societyId, deletedAt: null },
    });
    if (!row) throw new NotFoundException();
    await this.prisma.notice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  events(user: AuthUser) {
    return this.prisma.societyEvent.findMany({
      where: { societyId: this.sid(user), deletedAt: null },
      orderBy: { eventDate: 'asc' },
    });
  }

  async eventById(user: AuthUser, id: string) {
    const row = await this.prisma.societyEvent.findFirst({
      where: { id, societyId: this.sid(user), deletedAt: null },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  async createEvent(
    user: AuthUser,
    data: {
      title: string;
      date: string;
      endDate?: string;
      location: string;
      description?: string;
      budget?: number;
      status?: EventStatus;
    },
  ) {
    const societyId = this.sid(user);
    const tenantId = await this.prisma.getSocietyTenantId(societyId);
    return this.prisma.societyEvent.create({
      data: {
        tenantId,
        societyId,
        title: data.title,
        eventDate: new Date(data.date),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        location: data.location,
        description: data.description,
        budget: data.budget ?? 0,
        statusCode: data.status ?? EventStatus.UPCOMING,
      },
    });
  }

  async updateEvent(
    user: AuthUser,
    id: string,
    data: {
      title?: string;
      date?: string;
      endDate?: string;
      location?: string;
      description?: string;
      budget?: number;
      status?: EventStatus;
    },
  ) {
    const societyId = this.sid(user);
    const row = await this.prisma.societyEvent.findFirst({
      where: { id, societyId, deletedAt: null },
    });
    if (!row) throw new NotFoundException();
    return this.prisma.societyEvent.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.date !== undefined ? { eventDate: new Date(data.date) } : {}),
        ...(data.endDate !== undefined ? { endDate: new Date(data.endDate) } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.budget !== undefined ? { budget: data.budget } : {}),
        ...(data.status !== undefined ? { statusCode: data.status } : {}),
      },
    });
  }

  async deleteEvent(user: AuthUser, id: string) {
    const societyId = this.sid(user);
    const row = await this.prisma.societyEvent.findFirst({
      where: { id, societyId, deletedAt: null },
    });
    if (!row) throw new NotFoundException();
    await this.prisma.societyEvent.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  async dashboard(user: AuthUser) {
    const societyId = this.sid(user);
    const scope =
      user.role === Role.RESIDENT && user.memberId ? `m:${user.memberId}` : 'admin';
    const cacheKey = `dashboard:${societyId}:${scope}`;
    const cached = readCache.get<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const invoiceWhere =
      user.role === Role.RESIDENT && user.memberId
        ? { societyId, memberId: user.memberId, statusCode: { not: InvoiceStatus.CANCELLED } }
        : { societyId, statusCode: { not: InvoiceStatus.CANCELLED } };

    const outstandingFilter = {
      ...invoiceWhere,
      outstanding: { gt: 0 },
      deletedAt: null,
    };

    const todayStart = new Date(new Date().toISOString().slice(0, 10));

    const [invoiceAgg, next, latestNotice, upcomingEvent, lastReceipt, visitorsToday] =
      await Promise.all([
        this.prisma.invoice.aggregate({
          where: outstandingFilter,
          _sum: { outstanding: true },
          _count: true,
        }),
        this.prisma.invoice.findFirst({
          where: outstandingFilter,
          orderBy: { dueDate: 'asc' },
          select: { dueDate: true, invoiceNo: true },
        }),
        this.prisma.notice.findFirst({
          where: { societyId, deletedAt: null },
          orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
          select: {
            id: true,
            title: true,
            body: true,
            pinned: true,
            publishedAt: true,
            createdAt: true,
          },
        }),
        this.prisma.societyEvent.findFirst({
          where: {
            societyId,
            deletedAt: null,
            eventDate: { gte: new Date() },
            statusCode: { not: EventStatus.COMPLETED },
          },
          orderBy: { eventDate: 'asc' },
          select: {
            id: true,
            title: true,
            eventDate: true,
            endDate: true,
            location: true,
            description: true,
            statusCode: true,
          },
        }),
        this.prisma.receipt.findFirst({
          where: {
            societyId,
            deletedAt: null,
            ...(user.role === Role.RESIDENT && user.memberId ? { memberId: user.memberId } : {}),
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            receiptNo: true,
            amount: true,
            totalPaid: true,
            paymentDate: true,
            createdAt: true,
            modeCode: true,
          },
        }),
        this.prisma.visitor.count({
          where: {
            societyId,
            deletedAt: null,
            createdAt: { gte: todayStart },
          },
        }),
      ]);

    const outstandingTotal = Number(invoiceAgg._sum.outstanding ?? 0);

    const payload = {
      outstandingTotal,
      nextDueDate: next?.dueDate?.toISOString().slice(0, 10) ?? null,
      nextDueInvoiceNo: next?.invoiceNo ?? null,
      pendingInvoices: invoiceAgg._count,
      latestNotice,
      upcomingEvent,
      lastReceipt,
      visitorsToday,
    };
    readCache.set(cacheKey, payload, 45_000);
    return payload;
  }
}

@ApiTags('Community')
@ApiBearerAuth()
@Controller()
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Roles(Role.RESIDENT, Role.SOCIETY_ADMIN)
  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.community.dashboard(user);
  }

  @Roles(Role.RESIDENT, Role.SOCIETY_ADMIN)
  @Get('notices')
  notices(@CurrentUser() user: AuthUser) {
    return this.community.notices(user);
  }

  @Roles(Role.RESIDENT, Role.SOCIETY_ADMIN)
  @Get('notices/:id')
  notice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.community.noticeById(user, id);
  }

  @Roles(Role.SOCIETY_ADMIN)
  @Post('notices')
  createNotice(@CurrentUser() user: AuthUser, @Body() body: { title: string; body: string; pinned?: boolean }) {
    return this.community.createNotice(user, body);
  }

  @Roles(Role.SOCIETY_ADMIN)
  @Patch('notices/:id')
  updateNotice(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { title?: string; body?: string; pinned?: boolean },
  ) {
    return this.community.updateNotice(user, id, body);
  }

  @Roles(Role.SOCIETY_ADMIN)
  @Delete('notices/:id')
  deleteNotice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.community.deleteNotice(user, id);
  }

  @Roles(Role.RESIDENT, Role.SOCIETY_ADMIN)
  @Get('events')
  events(@CurrentUser() user: AuthUser) {
    return this.community.events(user);
  }

  @Roles(Role.RESIDENT, Role.SOCIETY_ADMIN)
  @Get('events/:id')
  event(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.community.eventById(user, id);
  }

  @Roles(Role.SOCIETY_ADMIN)
  @Post('events')
  createEvent(@CurrentUser() user: AuthUser, @Body() body: {
    title: string; date: string; endDate?: string; location: string; description?: string; budget?: number; status?: EventStatus;
  }) {
    return this.community.createEvent(user, body);
  }

  @Roles(Role.SOCIETY_ADMIN)
  @Patch('events/:id')
  updateEvent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: {
      title?: string; date?: string; endDate?: string; location?: string; description?: string; budget?: number; status?: EventStatus;
    },
  ) {
    return this.community.updateEvent(user, id, body);
  }

  @Roles(Role.SOCIETY_ADMIN)
  @Delete('events/:id')
  deleteEvent(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.community.deleteEvent(user, id);
  }
}

@Module({
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
