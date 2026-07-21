"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { invoiceService } from "@/services/invoice.service";
import { subscribeLiveData } from "@/lib/live-data-events";
import type { Invoice, InvoiceStatus } from "@/types";

export function useInvoices(societyId: string | undefined) {
  const [invoices, setInvoices] = useState<Invoice[]>(() =>
    societyId ? invoiceService.list(societyId) : []
  );
  const [loading, setLoading] = useState(false);

  const syncFromCache = useCallback(() => {
    if (!societyId) {
      setInvoices([]);
      return;
    }
    setInvoices(invoiceService.list(societyId));
  }, [societyId]);

  const refresh = useCallback(() => {
    if (!societyId) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    setLoading((prev) => prev || invoices.length === 0);
    void invoiceService.reload(societyId).finally(() => {
      syncFromCache();
      setLoading(false);
    });
  }, [societyId, syncFromCache, invoices.length]);

  useEffect(() => {
    syncFromCache();
  }, [syncFromCache]);

  useEffect(() => {
    if (!societyId) return;
    return subscribeLiveData("invoices", syncFromCache);
  }, [societyId, syncFromCache]);

  useLiveRefresh(refresh, !!societyId, { scope: "invoices", immediate: false });

  const generateMonthly = useCallback(
    async (month: string, _actor: string, _memberIds?: string[]) => {
      if (!societyId) return [];
      const created = await invoiceService.generateMonthly(societyId, month);
      syncFromCache();
      return created;
    },
    [societyId, syncFromCache]
  );

  const setStatus = useCallback(
    (invoiceNo: string, status: InvoiceStatus, actor: string, paidAmount?: number) => {
      const updated = invoiceService.updateStatus(
        invoiceNo,
        status,
        actor,
        paidAmount
      );
      syncFromCache();
      return updated;
    },
    [syncFromCache]
  );

  const duplicate = useCallback(
    (invoiceNo: string, actor: string) => {
      const copy = invoiceService.duplicate(invoiceNo, actor);
      syncFromCache();
      return copy;
    },
    [syncFromCache]
  );

  const remove = useCallback(
    async (invoiceNo: string, actor: string) => {
      if (!societyId) return false;
      try {
        await invoiceService.remove(invoiceNo, societyId, actor);
        syncFromCache();
        return true;
      } catch (e) {
        console.error("Failed to delete invoice:", e);
        syncFromCache();
        return false;
      }
    },
    [societyId, syncFromCache]
  );

  const stats = societyId ? invoiceService.stats(societyId) : null;

  return {
    invoices,
    loading,
    refresh,
    generateMonthly,
    setStatus,
    duplicate,
    remove,
    stats,
  };
}
