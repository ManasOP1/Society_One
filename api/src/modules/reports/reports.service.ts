import { Injectable } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus } from '../../common/types/roles';
import { toNumber } from '../../common/utils/decimal.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ReportingService } from '../reporting/reporting.service';

/**
 * Methods: #6 #7 #16 #29
 * Prefer matview / rpt_* shaped DTOs over live multi-join aggregates.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reporting: ReportingService,
  ) {}

  async collectionSummary(societyId: string, month?: string) {
    const monthly = await this.reporting.readMonthlyCollection(societyId, month ? 24 : 6);
    if (monthly && month) {
      const row = monthly.find((m) => m.billingMonth === month);
      if (row) {
        const byMode = await this.prisma.payment.groupBy({
          by: ['modeCode'],
          where: {
            societyId,
            statusCode: PaymentStatus.CAPTURED,
            invoice: { billingMonth: month },
          },
          _sum: { amount: true },
          _count: true,
        });
        return {
          societyId,
          month,
          source: 'cache',
          collection: {
            totalCollected: row.collected,
            paymentCount: byMode.reduce((s, r) => s + r._count, 0),
            byMode: byMode.map((r) => ({
              mode: r.modeCode,
              amount: toNumber(r._sum.amount),
              count: r._count,
            })),
          },
          billing: {
            invoiceCount: null as number | null,
            billed: row.billed,
            paid: row.collected,
            outstanding: row.outstanding,
          },
        };
      }
    }

    const paymentWhere = {
      societyId,
      statusCode: PaymentStatus.CAPTURED,
      ...(month ? { invoice: { billingMonth: month } } : {}),
    };

    const [captured, byMode, invoiceTotals] = await Promise.all([
      this.prisma.payment.aggregate({
        where: paymentWhere,
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payment.groupBy({
        by: ['modeCode'],
        where: paymentWhere,
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: {
          societyId,
          ...(month ? { billingMonth: month } : {}),
          statusCode: { not: InvoiceStatus.CANCELLED },
        },
        _sum: {
          totalAmount: true,
          paidAmount: true,
          outstanding: true,
        },
        _count: true,
      }),
    ]);

    return {
      societyId,
      month: month ?? null,
      source: 'live',
      collection: {
        totalCollected: toNumber(captured._sum.amount),
        paymentCount: captured._count,
        byMode: byMode.map((row) => ({
          mode: row.modeCode,
          amount: toNumber(row._sum.amount),
          count: row._count,
        })),
      },
      billing: {
        invoiceCount: invoiceTotals._count,
        billed: toNumber(invoiceTotals._sum.totalAmount),
        paid: toNumber(invoiceTotals._sum.paidAmount),
        outstanding: toNumber(invoiceTotals._sum.outstanding),
      },
    };
  }

  /** Chart series from mv_monthly_collection / rpt_* — one DTO. Methods #6 #16 #29 */
  async monthlySeries(societyId: string, limit = 6) {
    const cached = await this.reporting.readMonthlyCollection(societyId, limit);
    if (cached?.length) {
      return {
        societyId,
        source: 'cache',
        series: cached.map((row) => ({
          month: row.billingMonth,
          billed: row.billed,
          collection: row.collected,
          outstanding: row.outstanding,
          expense: Math.max(0, row.billed - row.collected),
        })),
      };
    }

    const months = await this.prisma.invoice.groupBy({
      by: ['billingMonth'],
      where: { societyId, deletedAt: null, statusCode: { not: InvoiceStatus.CANCELLED } },
      _sum: { totalAmount: true, paidAmount: true, outstanding: true },
      orderBy: { billingMonth: 'desc' },
      take: limit,
    });

    const series = months
      .map((row) => {
        const billed = toNumber(row._sum.totalAmount);
        const collection = toNumber(row._sum.paidAmount);
        return {
          month: row.billingMonth,
          billed,
          collection,
          outstanding: toNumber(row._sum.outstanding),
          expense: Math.max(0, billed - collection),
        };
      })
      .reverse();

    return { societyId, source: 'live', series };
  }

  async outstandingSummary(societyId: string) {
    const [byStatus, topOutstanding] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ['statusCode'],
        where: {
          societyId,
          statusCode: {
            in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE],
          },
        },
        _sum: { outstanding: true, totalAmount: true, paidAmount: true },
        _count: true,
      }),
      this.prisma.invoice.findMany({
        where: {
          societyId,
          outstanding: { gt: 0 },
          statusCode: { not: InvoiceStatus.CANCELLED },
        },
        orderBy: { outstanding: 'desc' },
        take: 20,
        select: {
          id: true,
          invoiceNo: true,
          billingMonth: true,
          statusCode: true,
          outstanding: true,
          totalAmount: true,
          paidAmount: true,
          member: { select: { id: true, ownerName: true, phone: true } },
          flat: { select: { flatNo: true, wing: { select: { code: true } } } },
        },
      }),
    ]);

    const totalOutstanding = byStatus.reduce(
      (s, row) => s + toNumber(row._sum.outstanding),
      0,
    );

    return {
      societyId,
      totalOutstanding,
      byStatus: byStatus.map((row) => ({
        status: row.statusCode,
        count: row._count,
        outstanding: toNumber(row._sum.outstanding),
        billed: toNumber(row._sum.totalAmount),
        paid: toNumber(row._sum.paidAmount),
      })),
      topOutstanding: topOutstanding.map((inv) => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        month: inv.billingMonth,
        status: inv.statusCode,
        outstanding: toNumber(inv.outstanding),
        totalAmount: toNumber(inv.totalAmount),
        paidAmount: toNumber(inv.paidAmount),
        member: inv.member,
        flat: inv.flat
          ? { wing: inv.flat.wing?.code ?? '', flatNo: inv.flat.flatNo }
          : null,
      })),
    };
  }
}
