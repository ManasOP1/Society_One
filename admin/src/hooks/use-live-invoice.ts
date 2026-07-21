"use client";

import { useCallback, useEffect, useState } from "react";
import { LIVE_SYNC_DEBOUNCE_MS } from "@/constants/live-sync";
import { invoiceService } from "@/services/invoice.service";
import { subscribeLiveData } from "@/lib/live-data-events";
import type { Invoice } from "@/types";

/** Keeps a single invoice in sync with the invoice cache (public link / receipt pages). */
export function useLiveInvoice(invoiceNo: string) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const refresh = useCallback(() => {
    if (!invoiceNo) {
      setInvoice(null);
      return;
    }
    setInvoice(invoiceService.getByNo(invoiceNo));
  }, [invoiceNo]);

  useEffect(() => {
    refresh();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refresh, LIVE_SYNC_DEBOUNCE_MS);
    };
    const unsub = subscribeLiveData("invoices", schedule);
    window.addEventListener("focus", schedule);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsub();
      window.removeEventListener("focus", schedule);
    };
  }, [refresh]);

  return { invoice, refresh };
}
