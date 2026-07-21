"use client";

import { useCallback, useEffect, useState } from "react";
import { invoiceService } from "@/services/invoice.service";
import type { Invoice } from "@/types";

/** Keeps a single invoice in sync with localStorage (public link / receipt pages). */
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
    const onStorage = () => refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("societyone-storage", onStorage);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("societyone-storage", onStorage);
    };
  }, [refresh]);

  return { invoice, refresh };
}
