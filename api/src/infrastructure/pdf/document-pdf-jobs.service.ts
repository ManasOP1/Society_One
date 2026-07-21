import { Injectable } from '@nestjs/common';
import { DocumentType } from '../../common/types/roles';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { SupabaseStorageService } from '../supabase/supabase-storage.service';

@Injectable()
export class DocumentPdfJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly storage: SupabaseStorageService,
  ) {}

  async generateAndStoreInvoicePdf(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        society: true,
        member: true,
        flat: { include: { wing: true } },
        lines: { orderBy: { lineNo: 'asc' } },
      },
    });
    if (!invoice) return;

    const lineItems = invoice.lines.map((l) => ({
      description: l.description,
      amount: Number(l.amount),
    }));
    const flatLabel = invoice.flat ? `${invoice.flat.wing.code}-${invoice.flat.flatNo}` : '—';
    const buffer = await this.pdf.invoicePdf({
      societyName: invoice.society.name,
      societyAddress: invoice.society.address,
      invoiceNo: invoice.invoiceNo,
      ownerName: invoice.member.ownerName,
      flat: flatLabel,
      month: invoice.billingMonth,
      totalAmount: Number(invoice.totalAmount),
      outstanding: Number(invoice.outstanding),
      dueDate: invoice.dueDate.toISOString().slice(0, 10),
      lineItems,
    });

    const uploaded = await this.storage.upload({
      societyId: invoice.societyId,
      folder: 'invoices',
      fileName: `${invoice.invoiceNo}.pdf`,
      body: buffer,
      contentType: 'application/pdf',
    });

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl: uploaded.url },
    });

    await this.prisma.document.create({
      data: {
        tenantId: invoice.tenantId,
        societyId: invoice.societyId,
        typeCode: DocumentType.INVOICE_PDF,
        fileName: `${invoice.invoiceNo}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: buffer.length,
        storagePath: uploaded.path,
        url: uploaded.url,
        entityType: 'invoice',
        entityId: invoice.id,
      },
    });

    return uploaded.url;
  }

  async generateAndStoreReceiptPdf(receiptId: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        society: true,
        member: true,
        invoice: { include: { flat: { include: { wing: true } } } },
      },
    });
    if (!receipt) return;

    const flatLabel = receipt.invoice.flat
      ? `${receipt.invoice.flat.wing.code}-${receipt.invoice.flat.flatNo}`
      : '—';
    const buffer = await this.pdf.receiptPdf({
      societyName: receipt.society.name,
      receiptNo: receipt.receiptNo,
      invoiceNo: receipt.invoice.invoiceNo,
      ownerName: receipt.member.ownerName,
      flat: flatLabel,
      totalPaid: Number(receipt.totalPaid),
      paymentDate: receipt.paymentDate.toISOString().slice(0, 10),
      paymentMode: receipt.modeCode,
      utr: receipt.utr ?? undefined,
    });

    const uploaded = await this.storage.upload({
      societyId: receipt.societyId,
      folder: 'receipts',
      fileName: `${receipt.receiptNo}.pdf`,
      body: buffer,
      contentType: 'application/pdf',
    });

    await this.prisma.receipt.update({
      where: { id: receipt.id },
      data: { pdfUrl: uploaded.url },
    });

    await this.prisma.document.create({
      data: {
        tenantId: receipt.tenantId,
        societyId: receipt.societyId,
        typeCode: DocumentType.RECEIPT_PDF,
        fileName: `${receipt.receiptNo}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: buffer.length,
        storagePath: uploaded.path,
        url: uploaded.url,
        entityType: 'receipt',
        entityId: receipt.id,
      },
    });

    return uploaded.url;
  }
}
