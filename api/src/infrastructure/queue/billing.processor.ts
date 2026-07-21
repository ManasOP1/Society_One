import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { InvoiceStatus } from '../../common/types/roles';
import { PrismaService } from '../prisma/prisma.service';
import {
  QUEUE_BILLING,
  QUEUE_NOTIFICATIONS,
  QUEUE_REMINDERS,
  type GenerateMonthlyBillsJob,
  type NotificationJob,
  type PaymentReminderJob,
  type PenaltyCalcJob,
} from './queue.constants';

@Processor(QUEUE_BILLING)
export class BillingProcessor extends WorkerHost {
  private readonly logger = new Logger(BillingProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<GenerateMonthlyBillsJob>) {
    const { societyId, month } = job.data;
    this.logger.log(`Generating bills for ${societyId} month=${month}`);

    const tenantId = await this.prisma.getSocietyTenantId(societyId);
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const settings = await this.prisma.societySettings.findUnique({
      where: { societyId },
    });
    if (!settings) throw new Error('Society settings missing');

    const members = await this.prisma.member.findMany({
      where: { societyId, isActive: true, deletedAt: null },
      include: {
        memberFlats: {
          where: { deletedAt: null },
          orderBy: { isPrimary: 'desc' },
          take: 1,
          select: { flatId: true },
        },
      },
    });

    const dueDay = Math.min(Math.max(settings.dueDay, 1), 28);
    const issueDate = new Date(`${month}-01T00:00:00.000Z`);
    const dueDate = new Date(Date.UTC(year, Number(monthStr) - 1, dueDay));

    const components = [
      { description: 'Municipal Dues', amount: Number(settings.municipalDues) },
      { description: 'Admin Expenses', amount: Number(settings.adminExpenses) },
      { description: 'Sinking Funds', amount: Number(settings.sinkingFunds) },
      { description: 'Building Maintenance', amount: Number(settings.buildingMaintenance) },
      { description: 'Parking Charges', amount: Number(settings.parkingCharges) },
      { description: 'Non-Occupancy Charges', amount: Number(settings.nonOccupancyCharges) },
    ].filter((c) => c.amount > 0);

    const maintenanceSubtotal =
      components.reduce((s, c) => s + c.amount, 0) || Number(settings.maintenanceAmount);

    let created = 0;
    for (const member of members) {
      const exists = await this.prisma.invoice.findFirst({
        where: { societyId, memberId: member.id, billingMonth: month },
      });
      if (exists) continue;

      const seq = await this.prisma.invoice.count({ where: { societyId, billingMonth: month } });
      const invoiceNo = `${settings.invoicePrefix}-${month.replace('-', '')}-${String(seq + 1).padStart(4, '0')}`;
      const total = maintenanceSubtotal;
      const lineItems = components.length
        ? components
        : [{ description: 'Maintenance', amount: total }];

      await this.prisma.invoice.create({
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
          maintenanceSubtotal: new Prisma.Decimal(total),
          totalAmount: new Prisma.Decimal(total),
          outstanding: new Prisma.Decimal(total),
          statusCode: InvoiceStatus.PENDING,
          lines: {
            create: lineItems.map((item, idx) => ({
              tenantId,
              societyId,
              lineNo: idx + 1,
              description: item.description,
              amount: item.amount,
            })),
          },
        },
      });
      created += 1;
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        societyId,
        actorId: job.data.actorId,
        action: 'MONTHLY_BILLS_GENERATED',
        entityType: 'Invoice',
        entityId: societyId,
        details: `Created ${created} invoices for ${month}`,
      },
    });

    return { created };
  }
}

@Processor(QUEUE_REMINDERS)
export class RemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(RemindersProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NOTIFICATIONS)
    private readonly notifications: Queue<NotificationJob>,
  ) {
    super();
  }

  async process(job: Job<PaymentReminderJob | PenaltyCalcJob>) {
    if ('invoiceId' in job.data) {
      return this.sendReminder(job.data);
    }
    return this.applyPenalties(job.data);
  }

  private async sendReminder(data: PaymentReminderJob) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: data.invoiceId, societyId: data.societyId },
      include: { member: true },
    });
    if (!invoice || Number(invoice.outstanding) <= 0) return;

    const recipient = invoice.member.phone ?? invoice.member.email;
    if (!recipient) return;

    const channel = invoice.member.phone ? 'WHATSAPP' : 'EMAIL';
    await this.notifications.add('reminder', {
      societyId: data.societyId,
      channel,
      recipient,
      subject: `Payment reminder — ${invoice.invoiceNo}`,
      body: `Reminder: ₹${Number(invoice.outstanding).toFixed(2)} outstanding for ${invoice.invoiceNo}. Due ${invoice.dueDate.toISOString().slice(0, 10)}.`,
      metadata: { invoiceId: invoice.id },
    });
  }

  private async applyPenalties(data: PenaltyCalcJob) {
    const asOf = data.asOfDate ? new Date(data.asOfDate) : new Date();
    const where: Prisma.InvoiceWhereInput = {
      statusCode: { in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] },
      dueDate: { lt: asOf },
      outstanding: { gt: 0 },
    };
    if (data.societyId) where.societyId = data.societyId;

    const overdue = await this.prisma.invoice.findMany({
      where,
      include: { society: { include: { settings: true } } },
    });
    let updated = 0;
    for (const inv of overdue) {
      const lateFee = Number(inv.society.settings?.lateFeeAmount ?? 500);
      if (Number(inv.lateFee) > 0 && inv.statusCode === InvoiceStatus.OVERDUE) continue;
      const newTotal =
        Number(inv.maintenanceSubtotal) +
        Number(inv.arrearsSubtotal) +
        lateFee +
        Number(inv.previousOutstanding) -
        Number(inv.advance);
      const outstanding = Math.max(0, newTotal - Number(inv.paidAmount));
      await this.prisma.invoice.update({
        where: { id: inv.id },
        data: {
          lateFee: new Prisma.Decimal(lateFee),
          totalAmount: new Prisma.Decimal(newTotal),
          outstanding: new Prisma.Decimal(outstanding),
          statusCode: InvoiceStatus.OVERDUE,
        },
      });
      updated += 1;
    }
    this.logger.log(`Penalty job updated ${updated} invoices`);
    return { updated };
  }
}
