"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download } from "lucide-react";
import { receiptService } from "@/services/payment.service";
import { auditService } from "@/services/audit.service";
import { printElementById } from "@/utils/print";
import type { Receipt } from "@/types";
import { Button } from "@/components/ui/button";
import { ReceiptDocument } from "@/components/invoices/receipt-document";

export default function PublicReceiptPage() {
  const params = useParams<{ receiptNo: string }>();
  const receiptNo = decodeURIComponent(params.receiptNo ?? "");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    const r = receiptService.getByNo(receiptNo);
    setReceipt(r);
    if (r) {
      auditService.log({
        societyId: r.societyId,
        action: "Receipt Downloaded",
        entityType: "receipt",
        entityId: r.receiptNo,
        details: `Viewed receipt ${r.receiptNo}`,
        actor: "Public",
      });
    }
  }, [receiptNo]);

  if (!receipt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-6">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold">Receipt not found</h1>
          <p className="mt-2 text-sm text-slate-500">{receiptNo}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] px-3 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-emerald-600">SocietyOne</p>
            <h1 className="text-xl font-bold text-slate-900">Payment Receipt</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                auditService.log({
                  societyId: receipt.societyId,
                  action: "Receipt Downloaded",
                  entityType: "receipt",
                  entityId: receipt.receiptNo,
                  details: `PDF print ${receipt.receiptNo}`,
                  actor: "Public",
                });
                printElementById("receipt-print-root", receipt.receiptNo);
              }}
            >
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/invoice/${receipt.invoiceNo}`}>View Invoice</Link>
            </Button>
          </div>
        </div>
        <ReceiptDocument receipt={receipt} />
      </div>
    </div>
  );
}
