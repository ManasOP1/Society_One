import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { toNumber } from '../../common/utils/decimal.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  QUEUE_REPORTING,
  type RefreshReportingJob,
} from '../../infrastructure/queue/queue.constants';

type MvDashboardRow = {
  society_id: string;
  outstanding_total: Prisma.Decimal | number;
  pending_invoices: bigint | number;
  payments_today: bigint | number;
  visitors_today: bigint | number;
};

type MvMonthlyRow = {
  society_id: string;
  billing_month: string;
  billed_amount: Prisma.Decimal | number;
  collected_amount: Prisma.Decimal | number;
  outstanding_amount: Prisma.Decimal | number;
  collection_pct: Prisma.Decimal | number;
};

/**
 * Methods: #6 #7 #16 #29 #30
 * Read path: matviews / rpt_* (O(1)/O(log n)).
 * Write path: schedule refresh after import/billing/payment — UI stays on caches.
 */
@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);
  private readonly pendingSocieties = new Set<string | '*'>();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_REPORTING)
    private readonly reportingQueue: Queue<RefreshReportingJob>,
  ) {}

  /** Debounced async refresh — method #30 */
  scheduleRefresh(societyId?: string) {
    this.pendingSocieties.add(societyId ?? '*');
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      const targets = [...this.pendingSocieties];
      this.pendingSocieties.clear();
      for (const target of targets) {
        const job: RefreshReportingJob = {
          societyId: target === '*' ? undefined : target,
        };
        void this.reportingQueue
          .add('refresh', job, {
            removeOnComplete: 50,
            removeOnFail: 20,
            attempts: 2,
          })
          .catch(() => {
            void this.refreshNow(job.societyId).catch((err) =>
              this.logger.warn(`Inline reporting refresh failed: ${String(err)}`),
            );
          });
      }
    }, 750);
  }

  /** Cron safety net — method #30 */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cronRefresh() {
    await this.refreshNow().catch((err) =>
      this.logger.warn(`Cron reporting refresh failed: ${String(err)}`),
    );
  }

  async refreshNow(societyId?: string) {
    await this.refreshMatviews();
    if (societyId) {
      await this.upsertRptForSociety(societyId);
    } else {
      const societies = await this.prisma.society.findMany({
        where: { deletedAt: null },
        select: { id: true },
        take: 200,
      });
      for (const s of societies) {
        await this.upsertRptForSociety(s.id);
      }
    }
  }

  private async refreshMatviews() {
    try {
      await this.prisma.$executeRaw`SELECT app.refresh_reporting_matviews()`;
    } catch (err) {
      this.logger.debug(
        `Matview refresh skipped (fn/matviews may be absent): ${String(err)}`,
      );
    }
  }

  /**
   * Upsert rpt_* from live aggregates when matviews unavailable, else from mv_monthly_collection.
   * Methods: #6 #16
   */
  async upsertRptForSociety(societyId: string) {
    const tenantId = await this.prisma.getSocietyTenantId(societyId);
    const today = new Date();
    const reportDate = new Date(today.toISOString().slice(0, 10));

    const [invoiceDay, paymentDay, outstanding] = await Promise.all([
      this.prisma.invoice.count({
        where: {
          societyId,
          deletedAt: null,
          createdAt: { gte: reportDate },
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          societyId,
          deletedAt: null,
          statusCode: 'CAPTURED',
          paidAt: { gte: reportDate },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: {
          societyId,
          deletedAt: null,
          outstanding: { gt: 0 },
          statusCode: { not: 'CANCELLED' },
        },
        _sum: { outstanding: true },
      }),
    ]);

    await this.prisma.rptSocietyDaily.upsert({
      where: {
        societyId_reportDate: { societyId, reportDate },
      },
      create: {
        tenantId,
        societyId,
        reportDate,
        invoicesIssued: invoiceDay,
        collectedAmount: toNumber(paymentDay._sum.amount),
        outstandingAmount: toNumber(outstanding._sum.outstanding),
        paymentsCount: paymentDay._count,
        refreshedAt: new Date(),
      },
      update: {
        invoicesIssued: invoiceDay,
        collectedAmount: toNumber(paymentDay._sum.amount),
        outstandingAmount: toNumber(outstanding._sum.outstanding),
        paymentsCount: paymentDay._count,
        refreshedAt: new Date(),
      },
    });

    const monthlyFromMv = await this.readMonthlyCollection(societyId).catch(() => null);
    if (monthlyFromMv?.length) {
      for (const row of monthlyFromMv) {
        await this.prisma.rptSocietyMonthly.upsert({
          where: {
            societyId_billingMonth: {
              societyId,
              billingMonth: row.billingMonth,
            },
          },
          create: {
            tenantId,
            societyId,
            billingMonth: row.billingMonth,
            billedAmount: row.billed,
            collectedAmount: row.collected,
            outstandingAmount: row.outstanding,
            collectionPct: row.collectionPct,
            refreshedAt: new Date(),
          },
          update: {
            billedAmount: row.billed,
            collectedAmount: row.collected,
            outstandingAmount: row.outstanding,
            collectionPct: row.collectionPct,
            refreshedAt: new Date(),
          },
        });
      }
      return;
    }

    const months = await this.prisma.invoice.groupBy({
      by: ['billingMonth'],
      where: { societyId, deletedAt: null, statusCode: { not: 'CANCELLED' } },
      _sum: { totalAmount: true, paidAmount: true, outstanding: true },
      orderBy: { billingMonth: 'desc' },
      take: 12,
    });

    for (const row of months) {
      const billed = toNumber(row._sum.totalAmount);
      const collected = toNumber(row._sum.paidAmount);
      const outstandingAmt = toNumber(row._sum.outstanding);
      const collectionPct = billed > 0 ? collected / billed : 0;
      await this.prisma.rptSocietyMonthly.upsert({
        where: {
          societyId_billingMonth: { societyId, billingMonth: row.billingMonth },
        },
        create: {
          tenantId,
          societyId,
          billingMonth: row.billingMonth,
          billedAmount: billed,
          collectedAmount: collected,
          outstandingAmount: outstandingAmt,
          collectionPct,
          refreshedAt: new Date(),
        },
        update: {
          billedAmount: billed,
          collectedAmount: collected,
          outstandingAmount: outstandingAmt,
          collectionPct,
          refreshedAt: new Date(),
        },
      });
    }
  }

  /** Prefer matview; fall back null so callers use live agg. Methods #6 #29 */
  async readDashboardSummary(societyId: string): Promise<{
    outstandingTotal: number;
    pendingInvoices: number;
    paymentsToday: number;
    visitorsToday: number;
  } | null> {
    try {
      const rows = await this.prisma.$queryRaw<MvDashboardRow[]>`
        SELECT society_id, outstanding_total, pending_invoices, payments_today, visitors_today
        FROM mv_dashboard_summary
        WHERE society_id = ${societyId}::uuid
        LIMIT 1
      `;
      const row = rows[0];
      if (!row) return null;
      return {
        outstandingTotal: Number(row.outstanding_total) || 0,
        pendingInvoices: Number(row.pending_invoices) || 0,
        paymentsToday: Number(row.payments_today) || 0,
        visitorsToday: Number(row.visitors_today) || 0,
      };
    } catch {
      return null;
    }
  }

  async readMonthlyCollection(societyId: string, limit = 6): Promise<
    | {
        billingMonth: string;
        billed: number;
        collected: number;
        outstanding: number;
        collectionPct: number;
      }[]
    | null
  > {
    try {
      const rows = await this.prisma.$queryRaw<MvMonthlyRow[]>`
        SELECT society_id, billing_month, billed_amount, collected_amount,
               outstanding_amount, collection_pct
        FROM mv_monthly_collection
        WHERE society_id = ${societyId}::uuid
        ORDER BY billing_month DESC
        LIMIT ${limit}
      `;
      if (!rows.length) return null;
      return rows
        .map((r) => ({
          billingMonth: r.billing_month,
          billed: Number(r.billed_amount) || 0,
          collected: Number(r.collected_amount) || 0,
          outstanding: Number(r.outstanding_amount) || 0,
          collectionPct: Number(r.collection_pct) || 0,
        }))
        .reverse();
    } catch {
      /* fall through to rpt_* */
    }

    const rpt = await this.prisma.rptSocietyMonthly.findMany({
      where: { societyId },
      orderBy: { billingMonth: 'desc' },
      take: limit,
    });
    if (!rpt.length) return null;
    return rpt
      .map((r) => ({
        billingMonth: r.billingMonth,
        billed: toNumber(r.billedAmount),
        collected: toNumber(r.collectedAmount),
        outstanding: toNumber(r.outstandingAmount),
        collectionPct: toNumber(r.collectionPct),
      }))
      .reverse();
  }
}
