"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, Building2, CheckCircle2 } from "lucide-react";
import { useLiveInvoice } from "@/hooks/use-live-invoice";
import { printElementById } from "@/utils/print";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InvoiceDocument } from "@/components/invoices/invoice-document";

export default function PublicInvoicePage() {
  const params = useParams<{ invoiceNo: string }>();
  const invoiceNo = decodeURIComponent(params.invoiceNo ?? "");
  const { invoice, loading, error } = useLiveInvoice(invoiceNo);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-6">
        <p className="text-sm text-slate-500">Loading invoice…</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-6">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold">Invoice not found</h1>
          <p className="mt-2 text-sm text-slate-500">{error || invoiceNo}</p>
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
            <h1 className="text-xl font-bold text-slate-900">Invoice</h1>
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

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800">
                <Building2 className="h-4 w-4" />
                Pay at society office
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> No dues
              </span>
            )}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">
            Online self-pay is handled in the SocietyOne resident app. Society
            admins can record office collections from the Payments page.
          </p>
        </div>
      </div>
    </div>
  );
}
