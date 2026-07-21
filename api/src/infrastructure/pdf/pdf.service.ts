import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export type InvoicePdfData = {
  societyName: string;
  societyAddress: string;
  invoiceNo: string;
  ownerName: string;
  flat: string;
  month: string;
  totalAmount: number;
  outstanding: number;
  dueDate: string;
  lineItems: { description: string; amount: number }[];
};

export type ReceiptPdfData = {
  societyName: string;
  receiptNo: string;
  invoiceNo: string;
  ownerName: string;
  flat: string;
  totalPaid: number;
  paymentDate: string;
  paymentMode: string;
  utr?: string;
};

@Injectable()
export class PdfService {
  async invoicePdf(data: InvoicePdfData): Promise<Buffer> {
    return this.render((doc) => {
      doc.fontSize(18).text(data.societyName, { align: 'left' });
      doc.fontSize(10).fillColor('#555').text(data.societyAddress);
      doc.moveDown();
      doc.fillColor('#000').fontSize(14).text(`Invoice ${data.invoiceNo}`);
      doc.fontSize(11).text(`Billed to: ${data.ownerName} (${data.flat})`);
      doc.text(`Month: ${data.month}`);
      doc.text(`Due: ${data.dueDate}`);
      doc.moveDown();
      for (const item of data.lineItems) {
        doc.text(`${item.description}: ₹${item.amount.toFixed(2)}`);
      }
      doc.moveDown();
      doc.fontSize(12).text(`Total: ₹${data.totalAmount.toFixed(2)}`);
      doc.text(`Outstanding: ₹${data.outstanding.toFixed(2)}`);
    });
  }

  async receiptPdf(data: ReceiptPdfData): Promise<Buffer> {
    return this.render((doc) => {
      doc.fontSize(18).text(data.societyName);
      doc.moveDown();
      doc.fontSize(14).text(`Receipt ${data.receiptNo}`);
      doc.fontSize(11).text(`Against invoice: ${data.invoiceNo}`);
      doc.text(`Received from: ${data.ownerName} (${data.flat})`);
      doc.text(`Amount: ₹${data.totalPaid.toFixed(2)}`);
      doc.text(`Date: ${data.paymentDate}`);
      doc.text(`Mode: ${data.paymentMode}`);
      if (data.utr) doc.text(`UTR: ${data.utr}`);
    });
  }

  private render(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      draw(doc);
      doc.end();
    });
  }
}
