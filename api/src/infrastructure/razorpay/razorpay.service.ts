import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';

export type CreateOrderInput = {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
};

@Injectable()
export class RazorpayService {
  private readonly client: Razorpay | null;
  private readonly webhookSecret: string;
  private readonly keySecret: string;
  private readonly keyId: string;
  /** When false, online Razorpay checkout is disabled (manual admin collection still works). */
  readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const flag = String(this.config.get<string>('RAZORPAY_ENABLED') ?? 'false')
      .trim()
      .toLowerCase();
    this.keyId = this.config.get<string>('RAZORPAY_KEY_ID') ?? '';
    this.keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET') ?? '';
    this.webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') ?? '';

    const keysLookReal =
      !!this.keyId &&
      !!this.keySecret &&
      !this.keyId.includes('placeholder') &&
      !this.keySecret.includes('placeholder');

    this.enabled = (flag === 'true' || flag === '1') && keysLookReal;

    if (this.enabled) {
      this.client = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret });
    } else {
      this.client = null;
    }
  }

  assertEnabled(): void {
    if (!this.enabled || !this.client) {
      throw new ServiceUnavailableException(
        'Online payments (Razorpay) are temporarily disabled. Society admins can still record cash/cheque collections. Razorpay will be enabled after deploy.',
      );
    }
  }

  async createOrder(input: CreateOrderInput) {
    this.assertEnabled();
    return this.client!.orders.create({
      amount: input.amountPaise,
      currency: input.currency ?? 'INR',
      receipt: input.receipt,
      notes: input.notes,
      payment_capture: true,
    });
  }

  /** Checkout signature verification (order_id|payment_id). */
  verifyCheckoutSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    this.assertEnabled();
    const payload = `${params.orderId}|${params.paymentId}`;
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(payload)
      .digest('hex');
    return timingSafeEqual(expected, params.signature);
  }

  /** Webhook signature verification (HMAC of raw body). */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    this.assertEnabled();
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    return timingSafeEqual(expected, signature);
  }

  async fetchPayment(paymentId: string) {
    this.assertEnabled();
    return this.client!.payments.fetch(paymentId);
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
