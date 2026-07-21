import { Injectable } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus } from '../../common/types/roles';
import { toNumber } from '../../common/utils/decimal.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async collectionSummary(societyId: string, month?: string) {
    const paymentWhere = {
      societyId,
      statusCode: PaymentStatus.CAPTURED,
      ...(month
        ? {
            invoice: { billingMonth: month },
          }
        : {}),
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
        include: {
          member: {
            select: { id: true, ownerName: true, phone: true },
          },
          flat: { include: { wing: true } },
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
          ? { wing: inv.flat.wing.code, flatNo: inv.flat.flatNo }
          : null,
      })),
    };
  }
}
