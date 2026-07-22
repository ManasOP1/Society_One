/**
 * Formal society maintenance invoice HTML — matches backend InvoiceDocument layout.
 * Used for on-screen preview (WebView) and PDF export on mobile.
 */

import type { Invoice, InvoiceLineItem, SocietySettings } from '@/api/types';
import { amountInWords } from '@/utils/amount-in-words';

const FONT = '"Times New Roman", Times, Georgia, "Liberation Serif", serif';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(n: number): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dmy(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

function billPeriod(month: string) {
  const [y, m] = month.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return {
    from: `01-${mm}-${y}`,
    to: `${String(days).padStart(2, '0')}-${mm}-${y}`,
    days,
  };
}

function resolveServiceItems(invoice: Invoice): InvoiceLineItem[] {
  const maintenanceItems =
    invoice.maintenanceItems.length > 0 ? invoice.maintenanceItems : [];
  const arrearsItems = invoice.arrearsItems ?? [];
  return [...maintenanceItems, ...arrearsItems];
}

function cell(extra = ''): string {
  return `border:1px solid #000;padding:2px 6px;vertical-align:middle;${extra}`;
}

export function invoiceDocumentHtml(
  invoice: Invoice,
  settings: SocietySettings | null
): string {
  const serviceItems = resolveServiceItems(invoice);
  const maintenanceItems =
    invoice.maintenanceItems.length > 0 ? invoice.maintenanceItems : serviceItems;
  const arrearsItems = invoice.arrearsItems ?? [];

  const currentBill =
    (invoice.maintenanceSubtotal ||
      maintenanceItems.reduce((s, i) => s + i.amount, 0)) +
    (invoice.arrearsSubtotal ||
      arrearsItems.reduce((s, i) => s + (i.isDeduction ? -i.amount : i.amount), 0));
  const previousOutstanding = invoice.previousOutstanding ?? 0;
  const payable = invoice.totalAmount;

  const societyName =
    settings?.societyName?.trim() || invoice.societyName || 'Society';
  const societyAddress =
    settings?.address?.trim() || invoice.societyAddress || '';
  const registrationNo =
    settings?.registrationNo?.trim() || invoice.registrationNo || 'NA';
  const panNumber = settings?.panNumber?.trim() || invoice.panNumber || 'NA';
  const logoDataUrl = settings?.logoDataUrl?.trim() || '';
  const period = billPeriod(invoice.month);
  const regYear =
    registrationNo.match(/\b(20\d{2})\b/)?.[1] ?? String(invoice.year);

  const words = `${payable < 0 ? 'Negative ' : ''}${amountInWords(Math.abs(payable))}`;

  const note1 =
    settings?.interestNote ||
    'If Payment is made after Due Date then interest will be charged @ 21%.';
  const note2 =
    'Late payment penalty charges after due date charge Rs.50/- extra per month.';
  const note3 =
    invoice.notes ||
    settings?.gstNote ||
    'Discrepancy if any observed in this bill should be intimated within 48 hours.';

  const logoHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="${esc(societyName)} logo" width="90" height="90" style="display:block;margin:0 auto;width:90px;height:90px;object-fit:contain;" />`
    : `<div style="width:90px;height:90px;margin:0 auto;border:1px solid #000;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:bold;letter-spacing:0.15em;">${esc(
        (settings?.logoText || 'LOGO').slice(0, 4).toUpperCase()
      )}</div>`;

  const lineRows = serviceItems
    .map((item) => {
      const amt = item.isDeduction ? -item.amount : item.amount;
      return `<tr>
        <td style="${cell('text-align:left;border-left:0;')}">${esc(item.description)}</td>
        <td style="${cell('text-align:center;')}">-</td>
        <td style="${cell('text-align:center;')}">-</td>
        <td style="${cell('text-align:right;')}">${money(item.amount)}</td>
        <td style="${cell('text-align:right;border-right:0;')}">${money(amt)}</td>
      </tr>`;
    })
    .join('');

  const payVia = settings
    ? `<span style="font-weight:bold;">Pay via :</span> UPI ${esc(settings.upiId)} · ${esc(settings.bankName)} A/C ${esc(settings.bankAccount)} · IFSC ${esc(settings.bankIfsc)}`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=2, user-scalable=yes" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body {
      padding: 6px;
      font-family: ${FONT};
      font-size: 12px;
      line-height: 1.35;
      -webkit-text-size-adjust: 100%;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; font-family: ${FONT}; }
    td { word-break: break-word; overflow-wrap: anywhere; white-space: normal; }
    .nowrap { white-space: nowrap; }
    .doc { width: 100%; max-width: 820px; margin: 0 auto; background: #fff; }
    @media (max-width: 420px) {
      body { font-size: 10px; padding: 4px; }
      .logo-cell { width: 72px !important; }
      .logo-cell img, .logo-cell > div { width: 56px !important; height: 56px !important; }
      .society-title { font-size: 13px !important; }
      .meta-label { font-size: 9.5px !important; }
    }
  </style>
</head>
<body>
  <div class="doc">
    <table style="border:2px solid #000;">
      <tr>
        <td style="border-bottom:1px solid #000;padding:0;">
          <table style="width:100%;">
            <tr>
              <td class="logo-cell" style="width:96px;border-right:1px solid #000;padding:6px;text-align:center;vertical-align:middle;">${logoHtml}</td>
              <td style="padding:6px;text-align:center;vertical-align:middle;">
                <div class="society-title" style="font-size:15px;font-weight:bold;text-transform:uppercase;text-decoration:underline;">${esc(societyName)}</div>
                <div style="margin-top:4px;font-size:11px;font-weight:bold;">Reg. No.: ${esc(registrationNo)}. Year: ${regYear} Date: ${dmy(invoice.issueDate)}</div>
                <div style="margin-top:2px;font-size:11px;font-weight:bold;">${esc(societyAddress)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #000;padding:4px 8px;text-align:center;font-weight:bold;">SOCIETY MAINTENANCE INVOICE</td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #000;padding:0;">
          <table>
            <tr>
              <td class="meta-label" style="${cell('width:18%;font-weight:bold;border-left:0;border-top:0;')}">GSTIN</td>
              <td style="${cell('width:32%;text-align:center;border-top:0;')}">NA</td>
              <td class="meta-label" style="${cell('width:25%;font-weight:bold;border-top:0;')}">INVOICE DATE</td>
              <td class="nowrap" style="${cell('width:25%;border-top:0;border-right:0;')}">${dmy(invoice.issueDate)}</td>
            </tr>
            <tr>
              <td class="meta-label" style="${cell('font-weight:bold;border-left:0;')}">PAN No.</td>
              <td style="${cell('text-align:center;')}">${esc(panNumber)}</td>
              <td class="meta-label" style="${cell('font-weight:bold;')}">INVOICE NO.</td>
              <td style="${cell('border-right:0;font-size:10.5px;')}">${esc(invoice.invoiceNo)}</td>
            </tr>
            <tr>
              <td colspan="2" style="${cell('font-weight:bold;border-left:0;')}">REVERSE CHARGE - N.A.</td>
              <td class="meta-label" style="${cell('font-weight:bold;')}">DUE DATE</td>
              <td class="nowrap" style="${cell('border-right:0;')}">${dmy(invoice.dueDate)}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="border-bottom:1px solid #000;padding:0;">
          <table>
            <tr>
              <td style="width:70%;border-right:1px solid #000;padding:0;vertical-align:top;">
                <table style="width:100%;">
                  <tr><td style="width:28%;padding:2px 6px;font-weight:bold;vertical-align:top;">INVOICE TO :</td><td style="padding:2px 6px;font-weight:bold;">${esc(invoice.ownerName)}</td></tr>
                  <tr><td style="padding:2px 6px;font-weight:bold;">FLAT NO. :</td><td style="padding:2px 6px;font-weight:bold;">${esc(invoice.wing)} WING-${esc(invoice.flatNo)}</td></tr>
                  <tr><td style="padding:2px 6px;font-weight:bold;">ADDRESS :</td><td style="padding:2px 6px;font-weight:bold;">${esc(invoice.ownerAddress || invoice.societyAddress || '—')}</td></tr>
                  <tr><td style="padding:2px 6px;font-weight:bold;">FLAT AREA :</td><td style="padding:2px 6px;font-weight:bold;">${invoice.areaSqft ? `${Number(invoice.areaSqft).toFixed(1)} Sqft` : '—'}</td></tr>
                  <tr><td style="padding:2px 6px;font-weight:bold;">MOBILE NO. :</td><td style="padding:2px 6px;font-weight:bold;">${esc(invoice.mobile || '—')}</td></tr>
                  <tr><td style="padding:2px 6px;font-weight:bold;">E-MAIL :</td><td style="padding:2px 6px;font-weight:bold;">${esc(invoice.email || '—')}</td></tr>
                </table>
              </td>
              <td style="width:30%;padding:8px;"></td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:0;">
          <table style="font-size:12.5px;">
            <tr>
              <td colspan="3" style="${cell('text-align:center;font-weight:bold;border-left:0;border-top:0;')}">Bill Period : ${period.from} to ${period.to}</td>
              <td colspan="2" style="${cell('text-align:center;font-weight:bold;border-top:0;border-right:0;')}">No. of Days : ${period.days}</td>
            </tr>
            <tr>
              <td style="${cell('width:40%;text-align:center;font-weight:bold;border-left:0;')}">Description of Services</td>
              <td style="${cell('width:12%;text-align:center;font-weight:bold;')}">Units</td>
              <td style="${cell('width:13%;text-align:center;font-weight:bold;')}">SAC Code</td>
              <td style="${cell('width:15%;text-align:center;font-weight:bold;')}">Rate (INR)</td>
              <td style="${cell('width:20%;text-align:center;font-weight:bold;border-right:0;')}">Amount<br/>Payable (INR)</td>
            </tr>
            ${lineRows}
            <tr><td colspan="4" style="${cell('border-left:0;')}">CGST @9%</td><td style="${cell('text-align:right;border-right:0;')}">${money(0)}</td></tr>
            <tr><td colspan="4" style="${cell('border-left:0;')}">SGST @9%</td><td style="${cell('text-align:right;border-right:0;')}">${money(0)}</td></tr>
            <tr><td colspan="4" style="${cell('font-weight:bold;border-left:0;')}">Current Bill Amount (INR)</td><td style="${cell('text-align:right;font-weight:bold;border-right:0;')}">${money(currentBill)}</td></tr>
            <tr><td colspan="4" style="${cell('border-left:0;')}">Last month&apos;s outstanding (INR)</td><td style="${cell('text-align:right;border-right:0;')}">${money(previousOutstanding)}</td></tr>
            <tr><td colspan="4" style="${cell('border-left:0;')}">Cheque Dishonor Charges (INR)</td><td style="${cell('text-align:right;border-right:0;')}">${money(0)}</td></tr>
            <tr><td colspan="4" style="${cell('font-weight:bold;border-left:0;border-bottom:0;')}">Payable Amount (INR)</td><td style="${cell('text-align:right;font-weight:bold;border-right:0;border-bottom:0;')}">${money(payable)}</td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="border-top:1px solid #000;padding:4px 8px;"><span style="font-weight:bold;">Amount in words : </span>${esc(words)}</td>
      </tr>
      <tr>
        <td style="border-top:1px solid #000;padding:6px 20px;font-size:12px;">
          <ol style="margin:0;padding-left:18px;">
            <li>${esc(note1)}</li>
            <li>${esc(note2)}</li>
            <li>${esc(note3)}</li>
          </ol>
        </td>
      </tr>
      <tr>
        <td style="border-top:1px solid #000;padding:0;">
          <table>
            <tr>
              <td style="width:50%;border-right:1px solid #000;padding:4px 8px;vertical-align:top;font-size:11px;">${payVia}</td>
              <td style="width:50%;padding:0;vertical-align:top;">
                <div style="border-bottom:1px solid #000;padding:4px 8px;font-size:12px;font-weight:bold;text-transform:uppercase;background:#d0d0d0;">${esc(societyName)}</div>
                <div style="padding:4px 8px;font-size:12px;font-weight:bold;">Signature:</div>
                <div style="height:48px;"></div>
                <div style="border-top:1px solid #000;padding:4px 8px;text-align:center;font-size:12px;font-weight:bold;background:#d0d0d0;">Authorized Signatory</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <div style="padding:12px 0;text-align:center;font-family:${FONT};">
      <div style="font-size:13px;font-weight:bold;">Powered by SocietyOne</div>
      <div style="margin-top:4px;font-size:11.5px;font-weight:bold;">This is an electronically generated document, hence does not require signature</div>
    </div>
    ${
      invoice.paidAmount > 0
        ? `<div style="margin-top:8px;padding:8px;border:1px solid #000;font-size:12px;">
            <strong>Paid:</strong> ${money(invoice.paidAmount)} &nbsp;|&nbsp;
            <strong>Outstanding:</strong> ${money(invoice.outstanding)} &nbsp;|&nbsp;
            <strong>Status:</strong> ${esc(invoice.status)}
          </div>`
        : ''
    }
  </div>
</body>
</html>`;
}
