"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { invoiceService } from "@/services/invoice.service";
import type { Invoice, InvoiceStatus } from "@/types";

export function useInvoices(societyId: string | undefined) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!societyId) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    void invoiceService.reload(societyId).finally(() => {
      setInvoices(invoiceService.list(societyId));
      setLoading(false);
    });
  }, [societyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useLiveRefresh(refresh, !!societyId);

  const generateMonthly = useCallback(
    async (month: string, _actor: string, _memberIds?: string[]) => {
      if (!societyId) return [];
      const created = await invoiceService.generateMonthly(societyId, month);
      refresh();
      return created;
    },
    [societyId, refresh]
  );

  const setStatus = useCallback(
    (invoiceNo: string, status: InvoiceStatus, actor: string, paidAmount?: number) => {
      const updated = invoiceService.updateStatus(
        invoiceNo,
        status,
        actor,
        paidAmount
      );
      refresh();
      return updated;
    },
    [refresh]
  );

  const duplicate = useCallback(
    (invoiceNo: string, actor: string) => {
      const copy = invoiceService.duplicate(invoiceNo, actor);
      refresh();
      return copy;
    },
    [refresh]
  );

  const remove = useCallback(
    async (invoiceNo: string, actor: string) => {
      if (!societyId) return false;
      try {
        await invoiceService.remove(invoiceNo, societyId, actor);
        refresh();
        return true;
      } catch (e) {
        console.error("Failed to delete invoice:", e);
        refresh();
        return false;
      }
    },
    [refresh, societyId]
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
