import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Receipt } from '@prisma/client';
import { Role } from '../../common/types/roles';
import { AuthUser } from '../../common/decorators/auth.decorators';
import { toNumber } from '../../common/utils/decimal.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

function serializeReceipt(r: Receipt & { member?: unknown; invoice?: unknown }) {
  return {
    ...r,
    month: r.billingMonth,
    mode: r.modeCode,
    amount: toNumber(r.amount),
    lateFee: toNumber(r.lateFee),
    totalPaid: toNumber(r.totalPaid),
  };
}

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    societyId: string,
    user: AuthUser,
    filters?: { month?: string },
  ) {
    const where: Prisma.ReceiptWhereInput = { societyId, deletedAt: null };
    if (user.role === Role.RESIDENT) {
      if (!user.memberId) throw new ForbiddenException('No member linked');
      where.memberId = user.memberId;
    }
    if (filters?.month) where.billingMonth = filters.month;

    const rows = await this.prisma.receipt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, ownerName: true } },
        invoice: { select: { id: true, invoiceNo: true, billingMonth: true } },
      },
    });
    return rows.map(serializeReceipt);
  }

  async getByReceiptNo(societyId: string, receiptNo: string, user: AuthUser) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { societyId_receiptNo: { societyId, receiptNo } },
      include: {
        member: true,
        invoice: true,
        payment: true,
      },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    if (user.role === Role.RESIDENT && receipt.memberId !== user.memberId) {
      throw new ForbiddenException('Cannot access this receipt');
    }
    return serializeReceipt(receipt);
  }

  async getById(societyId: string, id: string, user: AuthUser) {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id, societyId },
      include: {
        member: true,
        invoice: true,
        payment: true,
      },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    if (user.role === Role.RESIDENT && receipt.memberId !== user.memberId) {
      throw new ForbiddenException('Cannot access this receipt');
    }
    return serializeReceipt(receipt);
  }
}
