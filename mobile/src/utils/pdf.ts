/**
 * Invoice/receipt PDF generation + sharing (expo-print → expo-sharing).
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Invoice, Receipt, SocietySettings } from '@/api/types';
import { invoiceDocumentHtml } from '@/utils/invoice-document-html';
import { amountInWords } from '@/utils/amount-in-words';
import { formatDate, formatINRNumber, formatMonth } from '@/utils/format';

const BRAND = '#131417';
const ACCENT = '#D6F252';

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function money(amount: number): string {
  return `&#8377;${formatINRNumber(amount)}`;
}

function baseStyles(): string {
  return `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; padding: 32px; font-size: 13px; }
      .header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid ${ACCENT}; padding-bottom: 16px; margin-bottom: 20px; }
      .logo { width: 64px; height: 64px; border-radius: 12px; object-fit: contain; }
      .logo-fallback { width: 64px; height: 64px; border-radius: 12px; background: ${BRAND}; color: ${ACCENT}; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; }
      .society-name { font-size: 22px; font-weight: 800; color: ${BRAND}; }
      .muted { color: #64748B; }
      .doc-title { text-align: center; font-size: 15px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin: 12px 0 20px; color: #111827; }
      .meta { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
      .meta div { line-height: 1.7; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
      th { background: ${BRAND}; color: #fff; text-align: left; padding: 8px 12px; font-size: 12px; }
      th.num, td.num { text-align: right; }
      td { padding: 8px 12px; border-bottom: 1px solid #E2E8F0; }
      .section td { background: #F1F5F9; font-weight: 700; }
      .total-row td { background: ${ACCENT}55; font-weight: 800; font-size: 14px; border-bottom: none; }
      .words { margin: 12px 0 20px; padding: 12px 16px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; font-weight: 600; }
      .grid2 { display: flex; gap: 16px; }
      .box { flex: 1; border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 16px; line-height: 1.8; }
      .box h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND}; margin-bottom: 6px; }
      .footer { margin-top: 24px; font-size: 11px; color: #64748B; line-height: 1.7; }
      .stamp { margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
      .paid { color: #22C55E; border: 3px solid #22C55E; border-radius: 10px; padding: 6px 18px; font-size: 18px; font-weight: 800; transform: rotate(-6deg); display: inline-block; }
    </style>`;
}

function headerHtml(settings: SocietySettings): string {
  const logo = settings.logoDataUrl
    ? `<img class="logo" src="${settings.logoDataUrl}" />`
    : `<div class="logo-fallback">${esc((settings.logoText || settings.societyName).slice(0, 2).toUpperCase())}</div>`;
  return `
    <div class="header">
      ${logo}
      <div>
        <div class="society-name">${esc(settings.societyName)}</div>
        <div class="muted">${esc(settings.address)}</div>
        <div class="muted">Regn No: ${esc(settings.registrationNo)} &nbsp;|&nbsp; PAN: ${esc(settings.panNumber)}</div>
      </div>
    </div>`;
}

export function invoiceHtml(invoice: Invoice, settings: SocietySettings): string {
  return invoiceDocumentHtml(invoice, settings);
}

export function receiptHtml(receipt: Receipt, settings: SocietySettings): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />${baseStyles()}</head><body>
    ${headerHtml(settings)}
    <div class="doc-title">Payment Receipt</div>
    <div class="meta">
      <div>
        Received with thanks from<br/>
        <strong>${esc(receipt.ownerName)}</strong><br/>
        Flat ${esc(receipt.flatNo)}${receipt.wing ? `, Wing ${esc(receipt.wing)}` : ''}<br/>
        <span class="muted">${esc(receipt.mobile)}</span>
      </div>
      <div style="text-align:right">
        Receipt No: <strong>${esc(receipt.receiptNo)}</strong><br/>
        Against Invoice: ${esc(receipt.invoiceNo)}<br/>
        Date: ${formatDate(receipt.paymentDate)}
      </div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
      <tbody>
        <tr><td>Maintenance payment — ${esc(formatMonth(receipt.month))}</td><td class="num">${money(receipt.amount)}</td></tr>
        <tr><td>Payment Mode</td><td class="num">${esc(receipt.paymentMode)}</td></tr>
        <tr><td>Reference / UTR</td><td class="num">${esc(receipt.utr)}</td></tr>
        <tr class="total-row"><td>Total Received</td><td class="num">${money(receipt.totalPaid)}</td></tr>
      </tbody>
    </table>
    <div class="words">Amount in words: ${esc(amountInWords(receipt.totalPaid))}</div>
    <div class="footer">
      Collected by: ${esc(receipt.collectedBy)} · Bank: ${esc(receipt.bank)}<br/>
      This is a computer generated receipt and does not require a signature.
    </div>
    <div class="stamp"><span></span><span class="paid">PAID</span></div>
  </body></html>`;
}

/** Render HTML to PDF and open the native share sheet. */
export async function sharePdf(html: string, _fileName: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Browsers can't share files reliably — open the print dialog instead.
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  }
}
