import { BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '../../common/types/roles';
import { PaymentsService } from './payments.service';

describe('PaymentsService.settleCapturedPayment', () => {
  const razorpay = { verifyWebhookSignature: jest.fn() };
  const pdfQueue = { add: jest.fn() };
  const notificationQueue = { add: jest.fn() };

  function buildService(prisma: object) {
    return new PaymentsService(
      prisma as never,
      razorpay as never,
      pdfQueue as never,
      notificationQueue as never,
    );
  }

  it('rejects settlement when Razorpay amount does not match the order', async () => {
    const prisma = {
      payment: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'pay-1',
            amount: 100,
            statusCode: PaymentStatus.CREATED,
            invoiceId: 'inv-1',
            tenantId: 't1',
            societyId: 's1',
          }),
        update: jest.fn(),
      },
    };

    const service = buildService(prisma);

    await expect(
      service.settleCapturedPayment({
        razorpayOrderId: 'order_1',
        razorpayPaymentId: 'pay_rzp_1',
        amountPaise: 50_00,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
});
