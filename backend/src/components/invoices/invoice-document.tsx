"use client";

import { amountInWords } from "@/utils/amount-in-words";
import { useLiveSocietySettings } from "@/hooks/use-live-society-settings";
import type { Invoice, InvoiceLineItem, SocietySettings } from "@/types";

const FONT =
  '"Times New Roman", Times, Georgia, "Liberation Serif", serif';

function money(n: number) {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Convert YYYY-MM-DD → DD-MM-YYYY like the reference invoice */
function dmy(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

function billPeriod(month: string) {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return {
    from: `01-${mm}-${y}`,
    to: `${String(days).padStart(2, "0")}-${mm}-${y}`,
    days,
  };
}

const cell = "border border-black px-1.5 py-0.5 align-middle";
const cellR = `${cell} text-right`;
const cellC = `${cell} text-center`;
const cellL = `${cell} text-left`;

export function InvoiceDocument({
  invoice,
  settings: settingsOverride,
  id = "invoice-print-root",
}: {
  invoice: Invoice;
  settings?: SocietySettings | null;
  id?: string;
}) {
  const liveSettings = useLiveSocietySettings(invoice.societyId);
  const settings = liveSettings ?? settingsOverride ?? null;

  const maintenanceItems =
    invoice.maintenanceItems?.length > 0
      ? invoice.maintenanceItems
      : invoice.lineItems ?? [];
  const arrearsItems = invoice.arrearsItems ?? [];
  const serviceItems: InvoiceLineItem[] = [
    ...maintenanceItems,
    ...arrearsItems,
  ];

  const currentBill =
    (invoice.maintenanceSubtotal ??
      maintenanceItems.reduce((s, i) => s + i.amount, 0)) +
    (invoice.arrearsSubtotal ??
      arrearsItems.reduce(
        (s, i) => s + (i.isDeduction ? -i.amount : i.amount),
        0
      ));
  const previousOutstanding = invoice.previousOutstanding ?? 0;
  const payable = invoice.totalAmount;

  // Always prefer live society settings so logo / name / address updates
  // show on existing invoices without regenerating them.
  const societyName =
    settings?.societyName?.trim() || invoice.societyName || "Society";
  const societyAddress =
    settings?.address?.trim() || invoice.societyAddress || "";
  const registrationNo =
    settings?.registrationNo?.trim() ||
    invoice.registrationNo ||
    "NA";
  const panNumber =
    settings?.panNumber?.trim() || invoice.panNumber || "NA";
  const logoDataUrl = settings?.logoDataUrl?.trim() || "";
  const period = billPeriod(invoice.month);
  const regYear = registrationNo.match(/\b(20\d{2})\b/)?.[1] ?? String(invoice.year);

  const words = `${payable < 0 ? "Negative " : ""}${amountInWords(
    Math.abs(payable)
  )}`;

  const note1 =
    settings?.interestNote ||
    "If Payment is made after Due Date then interest will be charged @ 21%.";
  const note2 =
    "Late payment penalty charges after due date charge Rs.50/- extra per month.";
  const note3 =
    invoice.notes ||
    settings?.gstNote ||
    "Discrepancy if any observed in this bill should be intimated within 48 hours.";

  return (
    <div
      id={id}
      data-print-document="invoice"
      className="mx-auto max-w-[820px] bg-white text-black"
      style={{
        fontFamily: FONT,
        fontSize: "13px",
        lineHeight: 1.35,
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {/* Outer border frame — same as reference */}
      <table
        className="w-full border-collapse border-2 border-black"
        style={{ fontFamily: FONT }}
      >
        <tbody>
          {/* ── Society header with logo on LEFT ── */}
          <tr>
            <td className="border-b border-black p-0">
              <table
                className="w-full border-collapse"
                style={{ fontFamily: FONT }}
              >
                <tbody>
                  <tr>
                    <td className="w-[110px] border-0 border-r border-black p-2 align-middle text-center">
                      {logoDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoDataUrl}
                          alt={`${societyName} logo`}
                          width={90}
                          height={90}
                          className="mx-auto block h-[90px] w-[90px] object-contain"
                        />
                      ) : (
                        <div
                          className="mx-auto flex h-[90px] w-[90px] items-center justify-center border border-black text-[18px] font-bold tracking-widest"
                          style={{ fontFamily: FONT }}
                        >
                          {(settings?.logoText || "LOGO")
                            .slice(0, 4)
                            .toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="border-0 px-2 py-2 text-center align-middle">
                      <div
                        className="text-[17px] font-bold uppercase underline"
                        style={{ fontFamily: FONT }}
                      >
                        {societyName}
                      </div>
                      <div className="mt-1 text-[12.5px] font-bold">
                        Reg. No.: {registrationNo}. Year: {regYear} Date:{" "}
                        {dmy(invoice.issueDate)}
                      </div>
                      <div className="mt-0.5 text-[12.5px] font-bold">
                        {societyAddress}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* ── Title bar ── */}
          <tr>
            <td className="border-b border-black px-2 py-1 text-center text-[13px] font-bold">
              SOCIETY MAINTENANCE INVOICE
            </td>
          </tr>

          {/* ── GSTIN / Invoice meta ── */}
          <tr>
            <td className="border-b border-black p-0">
              <table className="w-full border-collapse" style={{ fontFamily: FONT }}>
                <tbody>
                  <tr>
                    <td className={`${cellL} w-[16%] border-0 border-r font-bold`}>
                      GSTIN :
                    </td>
                    <td className={`${cellC} w-[34%] border-0 border-r`}>NA</td>
                    <td className={`${cellL} w-[26%] border-0 border-r font-bold`}>
                      INVOICE DATE :
                    </td>
                    <td className={`${cellL} w-[24%] border-0`}>
                      {dmy(invoice.issueDate)}
                    </td>
                  </tr>
                  <tr>
                    <td className={`${cellL} border-0 border-r border-t font-bold`}>
                      PAN No. :
                    </td>
                    <td className={`${cellC} border-0 border-r border-t`}>
                      {panNumber}
                    </td>
                    <td className={`${cellL} border-0 border-r border-t font-bold`}>
                      INVOICE NO. :
                    </td>
                    <td className={`${cellL} border-0 border-t`}>
                      {invoice.invoiceNo}
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={2}
                      className={`${cellL} border-0 border-r border-t font-bold`}
                    >
                      REVERSE CHARGE - N.A.
                    </td>
                    <td className={`${cellL} border-0 border-r border-t font-bold`}>
                      DUE DATE :
                    </td>
                    <td className={`${cellL} border-0 border-t`}>
                      {dmy(invoice.dueDate)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* ── Invoice To ── */}
          <tr>
            <td className="border-b border-black p-0">
              <table className="w-full border-collapse" style={{ fontFamily: FONT }}>
                <tbody>
                  <tr>
                    <td className="w-[70%] border-0 border-r border-black p-0 align-top">
                      <table
                        className="w-full border-collapse"
                        style={{ fontFamily: FONT }}
                      >
                        <tbody>
                          <tr>
                            <td className="w-[28%] border-0 px-1.5 py-0.5 align-top font-bold">
                              INVOICE TO :
                            </td>
                            <td className="border-0 px-1.5 py-0.5 font-bold">
                              {invoice.ownerName}
                            </td>
                          </tr>
                          <tr>
                            <td className="border-0 px-1.5 py-0.5 font-bold">
                              FLAT NO. :
                            </td>
                            <td className="border-0 px-1.5 py-0.5 font-bold">
                              {invoice.wing} WING-{invoice.flatNo}
                            </td>
                          </tr>
                          <tr>
                            <td className="border-0 px-1.5 py-0.5 font-bold">
                              ADDRESS :
                            </td>
                            <td className="border-0 px-1.5 py-0.5 font-bold">
                              {invoice.ownerAddress || invoice.societyAddress}
                            </td>
                          </tr>
                          <tr>
                            <td className="border-0 px-1.5 py-0.5 font-bold">
                              FLAT AREA :
                            </td>
                            <td className="border-0 px-1.5 py-0.5 font-bold">
                              {invoice.areaSqft
                                ? `${Number(invoice.areaSqft).toFixed(1)} Sqft`
                                : "—"}
                            </td>
                          </tr>
                          <tr>
                            <td className="border-0 px-1.5 py-0.5 font-bold">
                              MOBILE NO. :
                            </td>
                            <td className="border-0 px-1.5 py-0.5 font-bold">
                              {invoice.mobile || "—"}
                            </td>
                          </tr>
                          <tr>
                            <td className="border-0 px-1.5 py-0.5 font-bold">
                              E-MAIL :
                            </td>
                            <td className="border-0 px-1.5 py-0.5 font-bold">
                              {invoice.email || "—"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                    <td className="w-[30%] border-0 p-2 align-middle" />
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* ── Services table ── */}
          <tr>
            <td className="p-0">
              <table
                className="w-full border-collapse"
                style={{ fontFamily: FONT, fontSize: "12.5px" }}
              >
                <tbody>
                  {/* Bill period */}
                  <tr>
                    <td
                      colSpan={3}
                      className={`${cellC} border-l-0 border-t-0 font-bold`}
                    >
                      Bill Period : {period.from} to {period.to}
                    </td>
                    <td
                      colSpan={2}
                      className={`${cellC} border-r-0 border-t-0 font-bold`}
                    >
                      No. of Days : {period.days}
                    </td>
                  </tr>

                  {/* Column headers */}
                  <tr>
                    <td className={`${cellC} w-[40%] border-l-0 font-bold`}>
                      Description of Services
                    </td>
                    <td className={`${cellC} w-[12%] font-bold`}>Units</td>
                    <td className={`${cellC} w-[13%] font-bold`}>SAC Code</td>
                    <td className={`${cellC} w-[15%] font-bold`}>Rate (INR)</td>
                    <td className={`${cellC} w-[20%] border-r-0 font-bold`}>
                      Amount
                      <br />
                      Payable (INR)
                    </td>
                  </tr>

                  {/* Line items */}
                  {serviceItems.map((item) => {
                    const amt = item.isDeduction ? -item.amount : item.amount;
                    return (
                      <tr key={item.id}>
                        <td className={`${cellL} border-l-0`}>
                          {item.description}
                        </td>
                        <td className={cellC}>-</td>
                        <td className={cellC}>-</td>
                        <td className={cellR}>{money(item.amount)}</td>
                        <td className={`${cellR} border-r-0`}>{money(amt)}</td>
                      </tr>
                    );
                  })}

                  {/* CGST / SGST */}
                  <tr>
                    <td colSpan={4} className={`${cellL} border-l-0`}>
                      CGST @9%
                    </td>
                    <td className={`${cellR} border-r-0`}>{money(0)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className={`${cellL} border-l-0`}>
                      SGST @9%
                    </td>
                    <td className={`${cellR} border-r-0`}>{money(0)}</td>
                  </tr>

                  {/* Totals */}
                  <tr>
                    <td colSpan={4} className={`${cellL} border-l-0 font-bold`}>
                      Current Bill Amount (INR)
                    </td>
                    <td className={`${cellR} border-r-0 font-bold`}>
                      {money(currentBill)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={4} className={`${cellL} border-l-0`}>
                      Last month&apos;s outstanding (INR)
                    </td>
                    <td className={`${cellR} border-r-0`}>
                      {money(previousOutstanding)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={4} className={`${cellL} border-l-0`}>
                      Cheque Dishonor Charges (INR)
                    </td>
                    <td className={`${cellR} border-r-0`}>{money(0)}</td>
                  </tr>
                  <tr>
                    <td
                      colSpan={4}
                      className={`${cellL} border-b-0 border-l-0 font-bold`}
                    >
                      Payable Amount (INR)
                    </td>
                    <td className={`${cellR} border-b-0 border-r-0 font-bold`}>
                      {money(payable)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          {/* ── Amount in words ── */}
          <tr>
            <td className="border-t border-black px-2 py-1">
              <span className="font-bold">Amount in words : </span>
              {words}
            </td>
          </tr>

          {/* ── Terms ── */}
          <tr>
            <td className="border-t border-black px-5 py-1.5">
              <ol className="list-decimal space-y-0.5 pl-4 text-[12px]">
                <li>{note1}</li>
                <li>{note2}</li>
                <li>{note3}</li>
              </ol>
            </td>
          </tr>

          {/* ── Signature ── */}
          <tr>
            <td className="border-t border-black p-0">
              <table className="w-full border-collapse" style={{ fontFamily: FONT }}>
                <tbody>
                  <tr>
                    <td className="w-1/2 border-0 border-r border-black px-2 py-1 align-top text-[11px]">
                      {settings ? (
                        <>
                          <span className="font-bold">Pay via :</span> UPI{" "}
                          {settings.upiId} · {settings.bankName} A/C{" "}
                          {settings.bankAccount} · IFSC {settings.bankIfsc}
                        </>
                      ) : null}
                    </td>
                    <td className="w-1/2 border-0 p-0 align-top">
                      <div
                        className="border-b border-black px-2 py-1 text-[12px] font-bold uppercase"
                        style={{ background: "#d0d0d0" }}
                      >
                        {societyName}
                      </div>
                      <div className="px-2 pt-1 text-[12px] font-bold">
                        Signature:
                      </div>
                      <div style={{ height: 48 }} />
                      <div
                        className="border-t border-black px-2 py-1 text-center text-[12px] font-bold"
                        style={{ background: "#d0d0d0" }}
                      >
                        Authorized Signatory
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Footer outside the border */}
      <div
        className="py-3 text-center text-black"
        style={{ fontFamily: FONT }}
      >
        <div className="text-[13px] font-bold">Powered by SocietyOne</div>
        <div className="mt-1 text-[11.5px] font-bold">
          This is an electronically generated document, hence does not require
          signature
        </div>
      </div>
    </div>
  );
}
