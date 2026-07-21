import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { InvoiceStatus, PaymentMode, PaymentStatus } from '../../common/types/roles';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RazorpayService } from '../../infrastructure/razorpay/razorpay.service';
import {
  QUEUE_NOTIFICATIONS,
  QUEUE_PDF,
  type NotificationJob,
  type PdfJob,
} from '../../infrastructure/queue/queue.constants';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    @InjectQueue(QUEUE_PDF) private readonly pdfQueue: Queue<PdfJob>,
    @InjectQueue(QUEUE_NOTIFICATIONS)
    private readonly notificationQueue: Queue<NotificationJob>,
  ) {}

  /** Public status for clients — whether Razorpay checkout is live. */
  getPaymentConfig() {
    return {
      razorpayEnabled: this.razorpay.enabled,
      onlinePaymentsEnabled: this.razorpay.enabled,
      message: this.razorpay.enabled
        ? 'Online payments are available.'
        : 'Online payments are temporarily disabled. Pay at the society office or ask admin to record payment.',
    };
  }

  /**
   * Resident/admin creates a Razorpay order for an outstanding invoice.
   * Payment success is NEVER trusted from the client — webhook settles.
   */
  async createOrder(params: {
    societyId: string;
    memberId: string | null;
    role: string;
    invoiceNo: string;
    amount?: number;
  }) {
    this.razorpay.assertEnabled();

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        societyId: params.societyId,
        invoiceNo: params.invoiceNo,
        statusCode: { not: InvoiceStatus.CANCELLED },
      },
      include: { member: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (params.role === 'RESIDENT' && params.memberId && invoice.memberId !== params.memberId) {
      throw new NotFoundException('Invoice not found');
    }

    const outstanding = Number(invoice.outstanding);
    if (outstanding <= 0) throw new BadRequestException('Invoice already paid');

    const amount = params.amount ?? outstanding;
    if (amount <= 0 || amount > outstanding) {
      throw new BadRequestException(`Amount must be between 0.01 and ${outstanding}`);
    }

    const amountPaise = Math.round(amount * 100);
    const order = await this.razorpay.createOrder({
      amountPaise,
      receipt: `${invoice.invoiceNo}`.slice(0, 40),
      notes: {
        societyId: params.societyId,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        memberId: invoice.memberId,
      },
    });

    const tenantId = await this.prisma.getSocietyTenantId(params.societyId);
    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        societyId: params.societyId,
        invoiceId: invoice.id,
        memberId: invoice.memberId,
        amount: new Prisma.Decimal(amount),
        modeCode: PaymentMode.RAZORPAY,
        statusCode: PaymentStatus.CREATED,
        razorpayOrderId: String(order.id),
        metadata: { razorpayOrderId: String(order.id) } as Prisma.InputJsonValue,
      },
    });

    return {
      paymentId: payment.id,
      orderId: order.id,
      amount,
      amountPaise,
      currency: 'INR',
      invoiceNo: invoice.invoiceNo,
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  }

  /**
   * After Razorpay Checkout completes in the mobile app, verify the HMAC
   * signature and settle the payment (same path as webhook, without waiting
   * for Razorpay to reach localhost).
   */
  async verifyCheckout(params: {
    societyId: string;
    memberId: string | null;
    role: string;
    orderId: string;
    paymentId: string;
    signature: string;
  }) {
    this.razorpay.assertEnabled();

    if (
      !this.razorpay.verifyCheckoutSignature({
        orderId: params.orderId,
        paymentId: params.paymentId,
        signature: params.signature,
      })
    ) {
      throw new BadRequestException('Invalid Razorpay payment signature');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { razorpayOrderId: params.orderId },
    });
    if (!payment || payment.societyId !== params.societyId) {
      throw new NotFoundException('Payment order not found');
    }
    if (params.role === 'RESIDENT' && params.memberId && payment.memberId !== params.memberId) {
      throw new NotFoundException('Payment order not found');
    }

    const rzpPayment = await this.razorpay.fetchPayment(params.paymentId);
    const status = String(rzpPayment.status ?? '');
    if (status !== 'captured' && status !== 'authorized') {
      throw new BadRequestException(`Payment not captured (status: ${status || 'unknown'})`);
    }

    await this.settleCapturedPayment({
      razorpayOrderId: params.orderId,
      razorpayPaymentId: params.paymentId,
      amountPaise: Number(rzpPayment.amount),
      method: typeof rzpPayment.method === 'string' ? rzpPayment.method : undefined,
      contact: typeof rzpPayment.contact === 'string' ? rzpPayment.contact : undefined,
      email: typeof rzpPayment.email === 'string' ? rzpPayment.email : undefined,
    });

    return this.buildPayResult(payment.id, params.paymentId);
  }

  /**
   * Society admin records cash / cheque / offline collection at the desk.
   */
  async recordManualPayment(params: {
    societyId: string;
    actorId: string;
    invoiceNo: string;
    amount: number;
    modeCode: string;
  }) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        societyId: params.societyId,
        invoiceNo: params.invoiceNo,
        deletedAt: null,
        statusCode: { not: InvoiceStatus.CANCELLED },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const outstanding = Number(invoice.outstanding);
    if (outstanding <= 0) throw new BadRequestException('Invoice already paid');
    if (params.amount <= 0 || params.amount > outstanding) {
      throw new BadRequestException(`Amount must be between 0.01 and ${outstanding}`);
    }

    const tenantId = await this.prisma.getSocietyTenantId(params.societyId);
    const payment = await this.prisma.payment.create({
      data: {
        tenantId,
        societyId: params.societyId,
        invoiceId: invoice.id,
        memberId: invoice.memberId,
        amount: new Prisma.Decimal(params.amount),
        modeCode: params.modeCode,
        statusCode: PaymentStatus.CREATED,
        metadata: { collectedBy: params.actorId, manual: true } as Prisma.InputJsonValue,
      },
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        statusCode: PaymentStatus.CAPTURED,
        paidAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        societyId: params.societyId,
        actorId: params.actorId,
        action: 'PAYMENT_RECORDED',
        entityType: 'Payment',
        entityId: payment.id,
        details: `Manual ${params.modeCode} collection of ${params.amount} for ${invoice.invoiceNo}`,
      },
    });

    return this.buildPayResult(payment.id, payment.id);
  }

  private async buildPayResult(paymentId: string, utr: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, invoiceId: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const [invoice, receipt] = await Promise.all([
      this.prisma.invoice.findUnique({
        where: { id: payment.invoiceId },
        include: {
          member: { select: { id: true, ownerName: true, phone: true, email: true } },
          flat: { include: { wing: true } },
          lines: { orderBy: { lineNo: 'asc' } },
          society: { select: { id: true, name: true, address: true, registrationNo: true, panNumber: true } },
        },
      }),
      this.prisma.receipt.findUnique({
        where: { paymentId },
        include: {
          member: { select: { ownerName: true, phone: true } },
          invoice: { select: { invoiceNo: true } },
          society: { select: { name: true } },
        },
      }),
    ]);
    if (!invoice) throw new NotFoundException('Invoice not found after payment');
    if (!receipt) throw new NotFoundException('Receipt not created — payment may still be processing');

    return {
      success: true,
      utr,
      invoice: {
        ...invoice,
        month: invoice.billingMonth,
        statusCode: invoice.statusCode,
        societyName: invoice.society.name,
        societyAddress: invoice.society.address ?? '',
        registrationNo: invoice.society.registrationNo ?? '',
        panNumber: invoice.society.panNumber ?? '',
        lineItems: invoice.lines.map((l) => ({
          id: l.id,
          description: l.description,
          amount: Number(l.amount),
          isDeduction: l.isDeduction,
        })),
      },
      receipt: {
        ...receipt,
        month: receipt.billingMonth,
        modeCode: receipt.modeCode,
        invoiceNo: receipt.invoice.invoiceNo,
        societyName: receipt.society.name,
        ownerName: receipt.member.ownerName,
        mobile: receipt.member.phone ?? '',
        amount: Number(receipt.amount),
        lateFee: Number(receipt.lateFee),
        totalPaid: Number(receipt.totalPaid),
      },
    };
  }

  /**
   * Razorpay webhook entrypoint — verifies signature, then settles.
   */
  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!signature || !this.razorpay.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid Razorpay webhook signature');
    }

    const payload = JSON.parse(rawBody.toString('utf8')) as {
      event: string;
      id?: string;
      payload?: {
        payment?: {
          entity?: {
            id: string;
            order_id: string;
            amount: number;
            status: string;
            method?: string;
            email?: string;
            contact?: string;
          };
        };
      };
    };

    const eventId =
      payload.id ?? `${payload.event}:${payload.payload?.payment?.entity?.id ?? Date.now()}`;
    const existing = await this.prisma.paymentWebhook.findUnique({
      where: { provider_eventId: { provider: 'razorpay', eventId } },
    });
    if (existing) {
      return { ok: true, duplicate: true };
    }

    await this.prisma.paymentWebhook.create({
      data: {
        provider: 'razorpay',
        eventId,
        eventType: payload.event,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    if (payload.event === 'payment.captured' || payload.event === 'payment.authorized') {
      const entity = payload.payload?.payment?.entity;
      if (!entity?.order_id || !entity?.id) {
        throw new BadRequestException('Malformed payment payload');
      }
      await this.settleCapturedPayment({
        razorpayOrderId: entity.order_id,
        razorpayPaymentId: entity.id,
        amountPaise: entity.amount,
        method: entity.method,
        contact: entity.contact,
        email: entity.email,
      });
    }

    return { ok: true };
  }

  /**
   * Settle a captured payment. Updating `payments.status_code` to CAPTURED fires a
   * DB trigger (trg_payments_status) that atomically creates the receipt, bumps
   * invoice.paid_amount, and (via trg_invoice_recalc) recomputes outstanding/status.
   * This method only needs to flip the payment row and then read back the results.
   */
  async settleCapturedPayment(input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    amountPaise: number;
    method?: string;
    contact?: string;
    email?: string;
  }) {
    const already = await this.prisma.payment.findUnique({
      where: { razorpayPaymentId: input.razorpayPaymentId },
    });
    if (already?.statusCode === PaymentStatus.CAPTURED) {
      return { duplicate: true, paymentId: already.id };
    }

    const payment = await this.prisma.payment.findUnique({
      where: { razorpayOrderId: input.razorpayOrderId },
    });
    if (!payment) throw new NotFoundException('Payment order not found');
    if (payment.statusCode === PaymentStatus.CAPTURED) {
      return { duplicate: true, paymentId: payment.id };
    }

    const payAmount = Number(payment.amount);
    const paidPaise = Math.round(payAmount * 100);
    if (paidPaise !== input.amountPaise) {
      throw new BadRequestException(
        `Payment amount mismatch for order ${input.razorpayOrderId}: expected ${paidPaise} paise, got ${input.amountPaise}`,
      );
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        statusCode: PaymentStatus.CAPTURED,
        razorpayPaymentId: input.razorpayPaymentId,
        paidAt: new Date(),
        modeCode: PaymentMode.RAZORPAY,
      },
    });

    const [invoice, receipt] = await Promise.all([
      this.prisma.invoice.findUnique({
        where: { id: updatedPayment.invoiceId },
        include: { member: true, society: true },
      }),
      this.prisma.receipt.findUnique({ where: { paymentId: updatedPayment.id } }),
    ]);
    if (!invoice) throw new NotFoundException('Invoice not found after settlement');

    await this.prisma.auditLog.create({
      data: {
        tenantId: updatedPayment.tenantId,
        societyId: updatedPayment.societyId,
        action: 'PAYMENT_CAPTURED',
        entityType: 'Payment',
        entityId: updatedPayment.id,
        details: `Captured ${payAmount} for ${invoice.invoiceNo}${receipt ? `; receipt ${receipt.receiptNo}` : ''}`,
        metadata: {
          razorpayPaymentId: input.razorpayPaymentId,
          razorpayOrderId: input.razorpayOrderId,
        },
      },
    });

    if (receipt) {
      await this.pdfQueue.add(
        'generate',
        { type: 'receipt', receiptId: receipt.id, societyId: receipt.societyId },
        { removeOnComplete: 1000, attempts: 3 },
      );
      await this.pdfQueue.add(
        'generate',
        { type: 'invoice', invoiceId: invoice.id, societyId: invoice.societyId },
        { removeOnComplete: 1000, attempts: 3 },
      );

      const phone = invoice.member.phone ?? input.contact;
      const email = invoice.member.email ?? input.email;
      if (phone) {
        await this.notificationQueue.add('whatsapp', {
          societyId: invoice.societyId,
          channel: 'WHATSAPP',
          recipient: phone,
          body: `Payment of ₹${Number(receipt.totalPaid).toFixed(2)} received for ${invoice.invoiceNo}. Receipt: ${receipt.receiptNo}`,
          metadata: { receiptId: receipt.id },
        });
      }
      if (email) {
        await this.notificationQueue.add('email', {
          societyId: invoice.societyId,
          channel: 'EMAIL',
          recipient: email,
          subject: `Payment receipt ${receipt.receiptNo}`,
          body: `Dear ${invoice.member.ownerName},\n\nWe received ₹${Number(receipt.totalPaid).toFixed(2)} for invoice ${invoice.invoiceNo}.\nReceipt: ${receipt.receiptNo}\n\nThank you,\n${invoice.society.name}`,
          metadata: { receiptId: receipt.id },
        });
      }
    }

    return { duplicate: false, paymentId: updatedPayment.id, receiptId: receipt?.id };
  }
}
