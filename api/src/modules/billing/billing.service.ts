import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Invoice, Prisma, SocietySettings } from '@prisma/client';
import { InvoiceStatus, Role } from '../../common/types/roles';
import { AuthUser } from '../../common/decorators/auth.decorators';
import {
  buildPaginationMeta,
  parsePagination,
  resolveListTake,
  wantsPagination,
  type PaginatedResult,
} from '../../common/utils/pagination.util';
import { activeOnly } from '../../common/utils/prisma-active.util';
import { toNumber } from '../../common/utils/decimal.util';
import { readCache } from '../../common/utils/ttl-cache';
import { BHK_LABELS, resolveFlatMaintenanceAmount } from '../../common/types/bhk';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PushNotificationService } from '../notifications/push-notification.service';

export type InvoiceLineItem = {
  description: string;
  amount: number;
  isDeduction?: boolean;
};

const INVOICE_LIST_INCLUDE = {
  member: { select: { id: true, ownerName: true, phone: true, email: true } },
  flat: { include: { wing: true } },
} satisfies Prisma.InvoiceInclude;

const INVOICE_INCLUDE = {
  ...INVOICE_LIST_INCLUDE,
  lines: { orderBy: { lineNo: 'asc' as const } },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithRelations = Invoice & {
  member?: unknown;
  flat?: unknown;
  lines?: { id: string; lineNo: number; code: string | null; description: string; amount: Prisma.Decimal; isDeduction: boolean }[];
};

function serializeInvoice(inv: InvoiceWithRelations) {
  return {
    ...inv,
    month: inv.billingMonth,
    status: inv.statusCode,
    maintenanceSubtotal: toNumber(inv.maintenanceSubtotal),
    arrearsSubtotal: toNumber(inv.arrearsSubtotal),
    lateFee: toNumber(inv.lateFee),
    previousOutstanding: toNumber(inv.previousOutstanding),
    advance: toNumber(inv.advance),
    totalAmount: toNumber(inv.totalAmount),
    paidAmount: toNumber(inv.paidAmount),
    outstanding: toNumber(inv.outstanding),
    lineItems: inv.lines?.map((l) => ({
      id: l.id,
      description: l.description,
      amount: toNumber(l.amount),
      isDeduction: l.isDeduction,
    })),
  };
}

function buildMaintenanceItems(
  settings: SocietySettings,
  flatMaintenanceAmount: number,
  bhkType?: string | null,
): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = [];
  const push = (description: string, amount: unknown) => {
    const n = toNumber(amount as { toString(): string });
    if (n > 0) items.push({ description, amount: n });
  };
  const bhkLabel =
    bhkType && bhkType in BHK_LABELS
      ? BHK_LABELS[bhkType as keyof typeof BHK_LABELS]
      : null;
  push(
    bhkLabel ? `Maintenance Charges (${bhkLabel})` : 'Maintenance Charges',
    flatMaintenanceAmount,
  );
  push('All Municipal Dues', settings.municipalDues);
  push('Administration and general Expenses', settings.adminExpenses);
  push('Sinking Funds', settings.sinkingFunds);
  push('Periodic Building Maintenance', settings.buildingMaintenance);
  push('Common Area Utilization / Parking', settings.parkingCharges);
  push('Non Occupancy Charges / Miscellaneous', settings.nonOccupancyCharges);
  return items;
}

function pad(n: number, len = 4) {
  return String(n).padStart(len, '0');
}

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly push: PushNotificationService,
  ) {}

  async list(
    societyId: string,
    user: AuthUser,
    filters?: { status?: InvoiceStatus; month?: string; page?: number; limit?: number },
  ) {
    const where: Prisma.InvoiceWhereInput = { societyId, ...activeOnly };
    if (user.role === Role.RESIDENT) {
      if (!user.memberId) throw new ForbiddenException('No member linked');
      where.memberId = user.memberId;
    }
    if (filters?.status) where.statusCode = filters.status;
    if (filters?.month) where.billingMonth = filters.month;

    const orderBy: Prisma.InvoiceOrderByWithRelationInput[] = [
      { year: 'desc' },
      { billingMonth: 'desc' },
      { createdAt: 'desc' },
    ];

    if (wantsPagination(filters)) {
      const { skip, take, page, limit } = parsePagination(filters);
      const [total, rows] = await this.prisma.$transaction([
        this.prisma.invoice.count({ where }),
        this.prisma.invoice.findMany({
          where,
          orderBy,
          skip,
          take,
          include: INVOICE_LIST_INCLUDE,
        }),
      ]);
      const result: PaginatedResult<ReturnType<typeof serializeInvoice>> = {
        data: rows.map(serializeInvoice),
        meta: buildPaginationMeta(total, page, limit),
      };
      return result;
    }

    const roleScope = user.role === Role.RESIDENT ? 'resident' : 'admin';
    const { take } = resolveListTake(filters, roleScope);
    const cacheKey = `invoices:${societyId}:${user.memberId ?? 'admin'}:${filters?.month ?? 'all'}:${filters?.status ?? 'all'}:${take}`;
    const cached = readCache.get<ReturnType<typeof serializeInvoice>[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.prisma.invoice.findMany({
      where,
      orderBy,
      take,
      include: INVOICE_LIST_INCLUDE,
    });
    const payload = rows.map(serializeInvoice);
    readCache.set(cacheKey, payload, 45_000);
    return payload;
  }

  async getByInvoiceNo(societyId: string, invoiceNo: string, user: AuthUser) {
    const inv = await this.prisma.invoice.findFirst({
      where: { societyId, invoiceNo, ...activeOnly },
      include: {
        ...INVOICE_INCLUDE,
        payments: { where: activeOnly },
        receipts: { where: activeOnly },
      },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    if (user.role === Role.RESIDENT && inv.memberId !== user.memberId) {
      throw new ForbiddenException('Cannot access this invoice');
    }
    return serializeInvoice(inv);
  }

  /** Unauthenticated public invoice view (shareable link). */
  async getPublicByInvoiceNo(invoiceNo: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { invoiceNo, deletedAt: null },
      include: {
        ...INVOICE_INCLUDE,
        society: {
          select: {
            id: true,
            name: true,
            address: true,
            registrationNo: true,
            panNumber: true,
          },
        },
      },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    const serialized = serializeInvoice(inv);
    return {
      ...serialized,
      societyId: inv.societyId,
      societyName: inv.society?.name ?? '',
      societyAddress: inv.society?.address ?? '',
      registrationNo: inv.society?.registrationNo ?? '',
      panNumber: inv.society?.panNumber ?? '',
    };
  }

  async generateMonthly(societyId: string, month: string, actor: AuthUser) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month must be YYYY-MM');
    }

    const tenantId = await this.prisma.getSocietyTenantId(societyId);
    const settings = await this.prisma.societySettings.findUnique({
      where: { societyId },
    });
    if (!settings) {
      throw new BadRequestException('Society settings not configured');
    }

    const [yearStr, monStr] = month.split('-');
    const year = Number(yearStr);
    const dueDay = Math.min(Math.max(settings.dueDay, 1), 28);
    const issueDate = new Date();
    const dueDate = new Date(`${month}-${pad(dueDay, 2)}T00:00:00.000Z`);

    const members = await this.prisma.member.findMany({
      where: { societyId, isActive: true, deletedAt: null },
      include: {
        memberFlats: {
          where: { deletedAt: null },
          orderBy: { isPrimary: 'desc' },
          take: 1,
          include: { flat: true },
        },
      },
    });

    const existing = await this.prisma.invoice.findMany({
      where: { societyId, billingMonth: month },
      select: { memberId: true },
    });
    const alreadyBilled = new Set(existing.map((e) => e.memberId));

    const prefix = `${settings.invoicePrefix}-${yearStr}-${monStr}-`;
    const last = await this.prisma.invoice.findMany({
      where: { societyId, invoiceNo: { startsWith: prefix } },
      select: { invoiceNo: true },
      orderBy: { invoiceNo: 'desc' },
      take: 1,
    });
    let seq = last.length > 0 ? Number(last[0].invoiceNo.slice(prefix.length)) || 0 : 0;

    const created: string[] = [];

    const outstandingRows = await this.prisma.invoice.groupBy({
      by: ['memberId'],
      where: {
        societyId,
        statusCode: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] },
        deletedAt: null,
      },
      _sum: { outstanding: true },
    });
    const outstandingByMember = new Map(
      outstandingRows.map((row) => [row.memberId, toNumber(row._sum.outstanding)]),
    );

    for (const member of members) {
      if (alreadyBilled.has(member.id)) continue;

      const primaryFlat = member.memberFlats[0]?.flat ?? null;
      const flatMaintenanceAmount = resolveFlatMaintenanceAmount(settings, primaryFlat);
      const maintenanceItems = buildMaintenanceItems(
        settings,
        flatMaintenanceAmount,
        primaryFlat?.bhkType,
      );
      const maintenanceSubtotal = maintenanceItems.reduce((s, i) => s + i.amount, 0);

      const previousOutstanding = outstandingByMember.get(member.id) ?? 0;
      const arrearsItems: InvoiceLineItem[] =
        previousOutstanding > 0
          ? [{ description: 'Other Arrears', amount: previousOutstanding }]
          : [];
      const arrearsSubtotal = arrearsItems.reduce((s, i) => s + i.amount, 0);
      const totalAmount = Math.max(0, maintenanceSubtotal + arrearsSubtotal);
      seq += 1;
      const invoiceNo = `${prefix}${pad(seq)}`;
      const lineItems = [...maintenanceItems, ...arrearsItems];

      const inv = await this.prisma.invoice.create({
        data: {
          tenantId,
          societyId,
          memberId: member.id,
          flatId: member.memberFlats[0]?.flatId,
          invoiceNo,
          billingMonth: month,
          year,
          issueDate,
          dueDate,
          maintenanceSubtotal,
          arrearsSubtotal,
          lateFee: 0,
          previousOutstanding,
          advance: 0,
          totalAmount,
          paidAmount: 0,
          outstanding: totalAmount,
          statusCode: InvoiceStatus.PENDING,
          notes: settings.gstNote,
          lines: {
            create: lineItems.map((item, idx) => ({
              tenantId,
              societyId,
              lineNo: idx + 1,
              description: item.description,
              amount: item.amount,
              isDeduction: item.isDeduction ?? false,
            })),
          },
        },
        select: { id: true },
      });
      created.push(inv.id);
    }

    await this.audit.log({
      societyId,
      actorId: actor.id,
      action: 'INVOICES_GENERATED',
      entityType: 'Invoice',
      entityId: societyId,
      details: `Generated ${created.length} invoices for ${month}`,
      metadata: { count: created.length, month },
    });

    readCache.deletePrefix(`invoices:${societyId}:`);
    readCache.deletePrefix(`dashboard:${societyId}:`);

    if (created.length > 0) {
      const label = formatBillingMonth(month);
      void this.push
        .notifySocietyResidents(societyId, {
          title: `${label} maintenance ready`,
          body: `Your ${label} maintenance invoice is available. Open SocietyOne to view and pay.`,
          data: { type: 'billing', month },
        })
        .catch(() => undefined);
    }

    return {
      month,
      generated: created.length,
      skipped: alreadyBilled.size,
      invoices: [],
    };
  }

  async remove(societyId: string, invoiceNo: string, actor: AuthUser) {
    if (actor.role === Role.RESIDENT) {
      throw new ForbiddenException('Residents cannot delete invoices');
    }

    const inv = await this.prisma.invoice.findFirst({
      where: { societyId, invoiceNo, deletedAt: null },
    });
    if (!inv) throw new NotFoundException('Invoice not found');

    await this.prisma.invoice.update({
      where: { id: inv.id },
      data: {
        deletedAt: new Date(),
        statusCode: InvoiceStatus.CANCELLED,
      },
    });

    await this.audit.log({
      societyId,
      actorId: actor.id,
      action: 'INVOICE_DELETED',
      entityType: 'Invoice',
      entityId: inv.id,
      details: invoiceNo,
    });

    return { success: true };
  }

  /**
   * Rebuilds line items and totals on unpaid invoices when society maintenance
   * rules change — keeps paidAmount intact and recalculates outstanding.
   */
  async syncOpenInvoicesFromSettings(societyId: string): Promise<number> {
    const settings = await this.prisma.societySettings.findUnique({
      where: { societyId },
    });
    if (!settings) return 0;

    const tenantId = await this.prisma.getSocietyTenantId(societyId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const openInvoices = await this.prisma.invoice.findMany({
      where: {
        societyId,
        deletedAt: null,
        statusCode: {
          in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE],
        },
      },
      include: {
        flat: true,
        member: {
          include: {
            memberFlats: {
              where: { deletedAt: null },
              orderBy: { isPrimary: 'desc' },
              take: 1,
              include: { flat: true },
            },
          },
        },
      },
    });

    let synced = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const inv of openInvoices) {
        const primaryFlat =
          inv.flat ??
          inv.member.memberFlats[0]?.flat ??
          null;
        const flatMaintenanceAmount = resolveFlatMaintenanceAmount(settings, primaryFlat);
        const maintenanceItems = buildMaintenanceItems(
          settings,
          flatMaintenanceAmount,
          primaryFlat?.bhkType,
        );
        const maintenanceSubtotal = maintenanceItems.reduce((s, i) => s + i.amount, 0);
        const previousOutstanding = toNumber(inv.previousOutstanding);
        const arrearsItems: InvoiceLineItem[] =
          previousOutstanding > 0
            ? [{ description: 'Other Arrears', amount: previousOutstanding }]
            : [];
        const arrearsSubtotal = arrearsItems.reduce((s, i) => s + i.amount, 0);
        const totalAmount = Math.max(0, maintenanceSubtotal + arrearsSubtotal);
        const paidAmount = toNumber(inv.paidAmount);
        const outstanding = Math.max(0, totalAmount - paidAmount);
        const lineItems = [...maintenanceItems, ...arrearsItems];

        const dueDay = Math.min(Math.max(settings.dueDay, 1), 28);
        const dueDate = new Date(
          `${inv.billingMonth}-${pad(dueDay, 2)}T00:00:00.000Z`,
        );
        let statusCode: InvoiceStatus = InvoiceStatus.PENDING;
        if (outstanding <= 0) statusCode = InvoiceStatus.PAID;
        else if (paidAmount > 0) statusCode = InvoiceStatus.PARTIAL;
        else if (dueDate < today) statusCode = InvoiceStatus.OVERDUE;

        await tx.invoiceLine.deleteMany({ where: { invoiceId: inv.id } });
        await tx.invoice.update({
          where: { id: inv.id },
          data: {
            flatId: primaryFlat?.id ?? inv.flatId,
            dueDate,
            maintenanceSubtotal,
            arrearsSubtotal,
            totalAmount,
            outstanding,
            statusCode,
            notes: settings.gstNote,
            lines: {
              create: lineItems.map((item, idx) => ({
                tenantId,
                societyId,
                lineNo: idx + 1,
                description: item.description,
                amount: item.amount,
                isDeduction: item.isDeduction ?? false,
              })),
            },
          },
        });
        synced += 1;
      }
    });

    return synced;
  }
}

function formatBillingMonth(ym: string) {
  const [y, m] = ym.split('-');
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${names[Number(m) - 1]} ${y}`;
}
