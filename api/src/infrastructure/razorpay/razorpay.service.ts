import { Injectable } from '@nestjs/common';
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
  private readonly client: Razorpay;
  private readonly webhookSecret: string;
  private readonly keySecret: string;

  constructor(private readonly config: ConfigService) {
    const keyId = this.config.getOrThrow<string>('RAZORPAY_KEY_ID');
    this.keySecret = this.config.getOrThrow<string>('RAZORPAY_KEY_SECRET');
    this.webhookSecret = this.config.getOrThrow<string>('RAZORPAY_WEBHOOK_SECRET');
    this.client = new Razorpay({ key_id: keyId, key_secret: this.keySecret });
  }

  async createOrder(input: CreateOrderInput) {
    return this.client.orders.create({
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
    const payload = `${params.orderId}|${params.paymentId}`;
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(payload)
      .digest('hex');
    return timingSafeEqual(expected, params.signature);
  }

  /** Webhook signature verification (HMAC of raw body). */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    return timingSafeEqual(expected, signature);
  }

  async fetchPayment(paymentId: string) {
    return this.client.payments.fetch(paymentId);
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
