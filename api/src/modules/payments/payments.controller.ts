import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Role } from '../../common/types/roles';
import { PaymentsService } from './payments.service';
import {
  CurrentUser,
  Public,
  Roles,
  type AuthUser,
} from '../../common/decorators/auth.decorators';

const CreateOrderSchema = z.object({
  invoiceNo: z.string().min(1),
  amount: z.number().positive().optional(),
});
class CreateOrderDto extends createZodDto(CreateOrderSchema) {}

const VerifyCheckoutSchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});
class VerifyCheckoutDto extends createZodDto(VerifyCheckoutSchema) {}

const ManualPaymentSchema = z.object({
  invoiceNo: z.string().min(1),
  amount: z.number().positive(),
  mode: z.enum([
    'UPI',
    'Net Banking',
    'Credit Card',
    'Debit Card',
    'Cash',
    'Cheque',
    'Wallet',
    'Other',
  ]),
});
class ManualPaymentDto extends createZodDto(ManualPaymentSchema) {}

const MANUAL_MODE_MAP: Record<string, string> = {
  UPI: 'UPI',
  'Net Banking': 'NET_BANKING',
  'Credit Card': 'CREDIT_CARD',
  'Debit Card': 'DEBIT_CARD',
  Cash: 'CASH',
  Cheque: 'CHEQUE',
  Wallet: 'WALLET',
  Other: 'OTHER',
};

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @ApiBearerAuth()
  @Roles(Role.RESIDENT, Role.SOCIETY_ADMIN)
  @Post('payments/orders')
  createOrder(@CurrentUser() user: AuthUser, @Body() body: CreateOrderDto) {
    if (!user.societyId) throw new BadRequestException('Society scope required');
    return this.payments.createOrder({
      societyId: user.societyId,
      memberId: user.memberId,
      role: user.role,
      invoiceNo: body.invoiceNo,
      amount: body.amount,
    });
  }

  /** Mobile app — verify Razorpay Checkout signature and settle immediately. */
  @ApiBearerAuth()
  @Roles(Role.RESIDENT, Role.SOCIETY_ADMIN)
  @Post('payments/verify')
  verifyCheckout(@CurrentUser() user: AuthUser, @Body() body: VerifyCheckoutDto) {
    if (!user.societyId) throw new BadRequestException('Society scope required');
    return this.payments.verifyCheckout({
      societyId: user.societyId,
      memberId: user.memberId,
      role: user.role,
      orderId: body.orderId,
      paymentId: body.paymentId,
      signature: body.signature,
    });
  }

  /** Admin offline collection (cash, cheque, etc.). */
  @ApiBearerAuth()
  @Roles(Role.SOCIETY_ADMIN, Role.SUPER_ADMIN)
  @Post('payments/manual')
  recordManual(@CurrentUser() user: AuthUser, @Body() body: ManualPaymentDto) {
    if (!user.societyId) throw new BadRequestException('Society scope required');
    return this.payments.recordManualPayment({
      societyId: user.societyId,
      actorId: user.id,
      invoiceNo: body.invoiceNo,
      amount: body.amount,
      modeCode: MANUAL_MODE_MAP[body.mode] ?? 'OTHER',
    });
  }

  /**
   * Razorpay webhook â€” public, signature-verified.
   * Requires raw body (see main.ts verify middleware).
   */
  @Public()
  @Post('webhooks/razorpay')
  handleWebhook(
    @Req() req: { rawBody?: Buffer; body: unknown },
    @Headers('x-razorpay-signature') signature: string | undefined,
  ) {
    const raw =
      req.rawBody ??
      Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}));
    return this.payments.handleWebhook(raw, signature);
  }
}
