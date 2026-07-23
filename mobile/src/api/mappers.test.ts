import { AxiosError } from 'axios';

import { apiErrorMessage } from '@/api/error-message';
import { unwrapListPayload } from '@/api/list-payload';
import {
  mapInvoice,
  mapInvoiceStatus,
  mapPaymentMode,
  mapReceipt,
  mapRole,
  mapVisitor,
} from '@/api/mappers';

describe('mapRole', () => {
  it('maps resident role for mobile app', () => {
    expect(mapRole('RESIDENT')).toBe('resident');
  });

  it('maps admin-like roles for compatibility but mobile rejects non-resident login', () => {
    expect(mapRole('SOCIETY_ADMIN')).toBe('admin');
  });
});

describe('unwrapListPayload', () => {
  it('returns arrays as-is', () => {
    const rows = [{ id: '1' }];
    expect(unwrapListPayload(rows)).toEqual(rows);
  });

  it('unwraps paginated { data, meta } payloads', () => {
    expect(
      unwrapListPayload({
        data: [{ id: 'a' }, { id: 'b' }],
        meta: { hasMore: true, total: 40 },
      })
    ).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('returns empty array for invalid payloads', () => {
    expect(unwrapListPayload(null)).toEqual([]);
    expect(unwrapListPayload(undefined)).toEqual([]);
    expect(unwrapListPayload({})).toEqual([]);
    expect(unwrapListPayload({ data: { id: 1 } })).toEqual([]);
  });
});

describe('mapInvoiceStatus / mapPaymentMode', () => {
  it('maps known invoice statuses and falls back safely', () => {
    expect(mapInvoiceStatus('PAID')).toBe('Paid');
    expect(mapInvoiceStatus('OVERDUE')).toBe('Overdue');
    expect(mapInvoiceStatus('UNKNOWN')).toBe('Pending');
  });

  it('maps payment mode codes', () => {
    expect(mapPaymentMode('NET_BANKING')).toBe('Net Banking');
    expect(mapPaymentMode('UPI')).toBe('UPI');
    expect(mapPaymentMode('NOPE')).toBe('Other');
  });
});

describe('mapInvoice', () => {
  it('maps nested Nest invoice rows without throwing', () => {
    const inv = mapInvoice({
      id: 'inv-1',
      invoiceNo: 'GV-INV-2026-07-0003',
      billingMonth: '2026-07',
      statusCode: 'PENDING',
      issueDate: '2026-07-21T00:00:00.000Z',
      dueDate: '2026-07-19T00:00:00.000Z',
      totalAmount: '2',
      paidAmount: 0,
      outstanding: '2',
      member: { ownerName: 'Sumit Shere', phone: '8600070563' },
      flat: { flatNo: '206', wing: { code: 'B' } },
      lineItems: [
        { id: '1', description: 'Maintenance', amount: 2 },
        { id: '2', description: 'Arrears previous', amount: 0 },
      ],
    });

    expect(inv.invoiceNo).toBe('GV-INV-2026-07-0003');
    expect(inv.month).toBe('2026-07');
    expect(inv.status).toBe('Pending');
    expect(inv.ownerName).toBe('Sumit Shere');
    expect(inv.flatNo).toBe('206');
    expect(inv.wing).toBe('B');
    expect(inv.issueDate).toBe('2026-07-21');
    expect(inv.dueDate).toBe('2026-07-19');
    expect(inv.totalAmount).toBe(2);
    expect(inv.outstanding).toBe(2);
  });

  it('tolerates sparse / missing fields', () => {
    const inv = mapInvoice({});
    expect(inv.invoiceNo).toBe('');
    expect(inv.totalAmount).toBe(0);
    expect(inv.status).toBe('Pending');
  });
});

describe('mapReceipt', () => {
  it('maps nested receipt fields and mode codes', () => {
    const rcpt = mapReceipt({
      id: 'r1',
      receiptNo: 'GV-RCP-2026-07-0001',
      billingMonth: '2026-07',
      modeCode: 'CASH',
      amount: 2,
      totalPaid: 2,
      paymentDate: '2026-07-22T10:00:00.000Z',
      invoice: { invoiceNo: 'GV-INV-2026-07-0003' },
      member: { ownerName: 'Sumit Shere' },
      flatNo: '206',
      wing: 'B',
    });

    expect(rcpt.receiptNo).toBe('GV-RCP-2026-07-0001');
    expect(rcpt.invoiceNo).toBe('GV-INV-2026-07-0003');
    expect(rcpt.month).toBe('2026-07');
    expect(rcpt.paymentMode).toBe('Cash');
    expect(rcpt.paymentDate).toBe('2026-07-22');
    expect(rcpt.ownerName).toBe('Sumit Shere');
    expect(rcpt.flatNo).toBe('206');
    expect(rcpt.wing).toBe('B');
  });

  it('derives wing/flat from nested invoice.flat', () => {
    const rcpt = mapReceipt({
      receiptNo: 'R-1',
      invoice: {
        invoiceNo: 'I-1',
        flat: { flatNo: '101', wing: { code: 'A' } },
      },
      member: { ownerName: 'Test' },
    });
    expect(rcpt.flatNo).toBe('101');
    expect(rcpt.wing).toBe('A');
  });
});

describe('mapVisitor', () => {
  it('maps flatLabel from Nest visitor rows', () => {
    const v = mapVisitor({
      id: 'v1',
      name: 'Courier',
      flatLabel: 'B-206',
      purpose: 'Delivery',
    });
    expect(v.flat).toBe('B-206');
    expect(v.name).toBe('Courier');
  });
});

describe('apiErrorMessage', () => {
  it('joins Nest validation message arrays', () => {
    const err = new AxiosError('Bad Request');
    err.response = {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: {} } as never,
      data: { message: ['amount must be positive', 'mode is required'] },
    };
    expect(apiErrorMessage(err)).toBe('amount must be positive, mode is required');
  });

  it('returns string messages as-is', () => {
    const err = new AxiosError('Bad Request');
    err.response = {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: {} } as never,
      data: { message: 'Invoice already paid' },
    };
    expect(apiErrorMessage(err)).toBe('Invoice already paid');
  });
});
