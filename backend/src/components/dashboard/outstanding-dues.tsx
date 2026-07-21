"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { invoiceService } from "@/services/invoice.service";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function OutstandingDues() {
  const { society } = useAuth();
  const dues = society
    ? invoiceService
        .list(society.id)
        .filter(
          (i) =>
            i.status !== "Cancelled" &&
            i.status !== "Paid" &&
            i.outstanding > 0
        )
        .slice(0, 4)
    : [];

  return (
    <div className="h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
          Outstanding dues
        </h3>
        <Link
          href="/payments"
          className="text-xs font-semibold text-[#4F46E5] hover:underline"
        >
          Collect
        </Link>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {dues.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">
            All clear for this society.
          </p>
        )}
        {dues.map((inv) => (
          <Link
            key={inv.id}
            href="/payments"
            className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors first:pt-1 last:pb-0 hover:bg-slate-50/80 dark:hover:bg-slate-700/40"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-xs font-bold text-[#4F46E5]">
              {inv.wing}
              {inv.flatNo.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {inv.ownerName}
                </p>
                <Badge
                  variant={
                    inv.status === "Overdue"
                      ? "danger"
                      : inv.status === "Partial"
                        ? "info"
                        : "warning"
                  }
                  className="shrink-0"
                >
                  {inv.status}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                {inv.wing}-{inv.flatNo} · {formatCurrency(inv.outstanding)} due
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
