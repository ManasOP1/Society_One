import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role } from '../../common/types/roles';
import { AuthUser } from '../../common/decorators/auth.decorators';
import {
  buildPaginationMeta,
  clampLimit,
  createdAtIdKeysetWhere,
  decodeKeysetCursor,
  encodeKeysetCursor,
  parsePagination,
  resolveListTake,
  wantsKeyset,
  wantsPagination,
  type PaginatedResult,
} from '../../common/utils/pagination.util';
import { toNumber } from '../../common/utils/decimal.util';
import { readCache } from '../../common/utils/ttl-cache';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/** Slim list DTO — method #9 */
function serializeReceiptList(r: {
  id: string;
  receiptNo: string;
  billingMonth: string;
  modeCode: string;
  amount: Prisma.Decimal | number;
  lateFee: Prisma.Decimal | number;
  totalPaid: Prisma.Decimal | number;
  paymentDate: Date;
  createdAt: Date;
  utr?: string | null;
  member?: { id: string; ownerName: string } | null;
  invoice?: {
    invoiceNo?: string;
    flat?: { flatNo?: string; wing?: { code?: string } | null } | null;
  } | null;
}) {
  const flat = r.invoice?.flat;
  return {
    id: r.id,
    receiptNo: r.receiptNo,
    month: r.billingMonth,
    billingMonth: r.billingMonth,
    mode: r.modeCode,
    modeCode: r.modeCode,
    amount: toNumber(r.amount as never),
    lateFee: toNumber(r.lateFee as never),
    totalPaid: toNumber(r.totalPaid as never),
    paymentDate: r.paymentDate,
    createdAt: r.createdAt,
    utr: r.utr,
    member: r.member,
    ownerName: r.member?.ownerName ?? '',
    invoiceNo: r.invoice?.invoiceNo ?? '',
    flatNo: flat?.flatNo ?? null,
    wing: flat?.wing?.code ?? null,
  };
}

function serializeReceipt(r: {
  id: string;
  receiptNo: string;
  billingMonth: string;
  modeCode: string;
  amount: Prisma.Decimal | number;
  lateFee: Prisma.Decimal | number;
  totalPaid: Prisma.Decimal | number;
  paymentDate: Date;
  createdAt: Date;
  utr?: string | null;
  member?: unknown;
  invoice?: {
    invoiceNo?: string;
    billingMonth?: string;
    flat?: { flatNo?: string; wing?: { code?: string } | null } | null;
  } | null;
}) {
  return {
    ...serializeReceiptList(r as never),
    invoice: r.invoice,
    member: r.member,
  };
}

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    societyId: string,
    user: AuthUser,
    filters?: { month?: string; page?: number; limit?: number; cursor?: string },
  ) {
    const where: Prisma.ReceiptWhereInput = { societyId, deletedAt: null };
    if (user.role === Role.RESIDENT) {
      if (!user.memberId) throw new ForbiddenException('No member linked');
      where.memberId = user.memberId;
    }
    if (filters?.month) where.billingMonth = filters.month;

    const orderBy: Prisma.ReceiptOrderByWithRelationInput[] = [
      { createdAt: 'desc' },
      { id: 'desc' },
    ];
    const select = {
      id: true,
      receiptNo: true,
      billingMonth: true,
      modeCode: true,
      amount: true,
      lateFee: true,
      totalPaid: true,
      paymentDate: true,
      createdAt: true,
      utr: true,
      member: { select: { id: true, ownerName: true } },
      invoice: {
        select: {
          invoiceNo: true,
          flat: { select: { flatNo: true, wing: { select: { code: true } } } },
        },
      },
    } satisfies Prisma.ReceiptSelect;

    if (wantsKeyset(filters)) {
      const cursor = decodeKeysetCursor(filters?.cursor);
      const take = clampLimit(filters?.limit, 50);
      const keysetWhere: Prisma.ReceiptWhereInput = {
        AND: [where, cursor ? createdAtIdKeysetWhere(cursor) : {}],
      };
      const rows = await this.prisma.receipt.findMany({
        where: keysetWhere,
        orderBy,
        take: take + 1,
        select,
      });
      const hasMore = rows.length > take;
      const pageRows = hasMore ? rows.slice(0, take) : rows;
      const data = pageRows.map(serializeReceiptList);
      const last = pageRows[pageRows.length - 1];
      return {
        data,
        meta: {
          total: -1,
          page: 1,
          limit: take,
          totalPages: -1,
          hasMore,
          nextCursor: hasMore && last ? encodeKeysetCursor(last) : null,
        },
      } satisfies PaginatedResult<(typeof data)[number]>;
    }

    if (wantsPagination(filters)) {
      const { skip, take, page, limit } = parsePagination(filters);
      const [total, rows] = await this.prisma.$transaction([
        this.prisma.receipt.count({ where }),
        this.prisma.receipt.findMany({ where, orderBy, skip, take, select }),
      ]);
      const result: PaginatedResult<ReturnType<typeof serializeReceiptList>> = {
        data: rows.map(serializeReceiptList),
        meta: buildPaginationMeta(total, page, limit),
      };
      return result;
    }

    const roleScope = user.role === Role.RESIDENT ? 'resident' : 'admin';
    const { take } = resolveListTake(filters, roleScope);
    const cacheKey = `receipts:${societyId}:${user.memberId ?? 'admin'}:${filters?.month ?? 'all'}:${take}`;
    const cached = readCache.get<ReturnType<typeof serializeReceiptList>[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.prisma.receipt.findMany({
      where,
      orderBy,
      take,
      select,
    });
    const payload = rows.map(serializeReceiptList);
    readCache.set(cacheKey, payload, 45_000);
    return payload;
  }

  async getByReceiptNo(societyId: string, receiptNo: string, user: AuthUser) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { societyId_receiptNo: { societyId, receiptNo } },
      include: {
        member: true,
        invoice: {
          include: { flat: { include: { wing: true } } },
        },
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
      where: { id, societyId, deletedAt: null },
      include: {
        member: true,
        invoice: {
          include: { flat: { include: { wing: true } } },
        },
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
