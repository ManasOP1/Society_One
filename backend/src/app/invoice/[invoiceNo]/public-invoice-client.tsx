"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Download, CreditCard, CheckCircle2 } from "lucide-react";
import { paymentService } from "@/services/payment.service";
import { auditService } from "@/services/audit.service";
import { useLiveInvoice } from "@/hooks/use-live-invoice";
import { printElementById } from "@/utils/print";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InvoiceDocument } from "@/components/invoices/invoice-document";

export default function PublicInvoicePage() {
  const params = useParams<{ invoiceNo: string }>();
  const search = useSearchParams();
  const invoiceNo = decodeURIComponent(params.invoiceNo ?? "");
  const { invoice, refresh } = useLiveInvoice(invoiceNo);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<{ receiptNo: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (search.get("pay") === "1" && invoice && invoice.outstanding > 0) {
      document
        .getElementById("pay-section")
        ?.scrollIntoView({ behavior: "smooth" });
    }
  }, [search, invoice]);

  const onPay = async () => {
    if (!invoice) return;
    setPaying(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 800));
      const result = paymentService.markFullyPaid(
        invoice.invoiceNo,
        "Online (Mock)",
        "UPI"
      );
      setDone({ receiptNo: result.receipt.receiptNo });
      refresh();
      auditService.log({
        societyId: invoice.societyId,
        action: "Mock Online Payment",
        entityType: "payment",
        entityId: result.receipt.receiptNo,
        details: `Public pay for ${invoice.invoiceNo}`,
        actor: "Resident",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  if (!invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-6">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold">Invoice not found</h1>
          <p className="mt-2 text-sm text-slate-500">{invoiceNo}</p>
          <Link
            href="/login"
            className="mt-4 inline-flex h-10 items-center rounded-2xl bg-[#4F46E5] px-4 text-sm font-medium text-white"
          >
            Society Admin Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] px-3 py-6 sm:px-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl space-y-4 print:max-w-none print:space-y-0">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <p className="text-sm font-medium text-[#4F46E5]">SocietyOne</p>
            <h1 className="text-xl font-bold text-slate-900">Public Invoice</h1>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              printElementById("invoice-print-root", invoice.invoiceNo)
            }
          >
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>

        <InvoiceDocument invoice={invoice} />

        <div
          id="pay-section"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Payment</p>
              <p className="text-xs text-slate-500">
                Outstanding:{" "}
                <strong className="text-red-600">
                  {formatCurrency(invoice.outstanding)}
                </strong>
              </p>
            </div>
            {invoice.outstanding > 0 && invoice.status !== "Cancelled" ? (
              <Button onClick={onPay} disabled={paying}>
                <CreditCard className="h-4 w-4" />
                {paying ? "Processing…" : "Pay Now (Mock)"}
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> No dues
              </span>
            )}
          </div>
          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          {done && (
            <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Payment simulated successfully. Receipt{" "}
              <Link
                className="font-semibold underline"
                href={`/receipt/${done.receiptNo}`}
              >
                {done.receiptNo}
              </Link>
            </div>
          )}
          <p className="mt-3 text-[11px] text-slate-400">
            Demo payment only — invoice/invoice status update for this
            session; receipt and audit log are saved locally.
          </p>
        </div>
      </div>
    </div>
  );
}
