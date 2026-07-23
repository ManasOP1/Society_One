"use client";

import { useCallback, useEffect, useState } from "react";
import { apiErrorMessage } from "@/lib/api-client";
import { invoiceService } from "@/services/invoice.service";
import type { Invoice } from "@/types";

/** Loads a shareable invoice from the public Nest API (no admin session required). */
export function useLiveInvoice(invoiceNo: string) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!invoiceNo) {
      setInvoice(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await invoiceService.fetchPublicByNo(invoiceNo);
      setInvoice(row);
    } catch (e) {
      setInvoice(null);
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [invoiceNo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { invoice, loading, error, refresh };
}
