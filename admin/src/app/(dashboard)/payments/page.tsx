"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Smartphone,
  Building2,
  Wallet,
  Banknote,
  Download,
  Receipt,
  ExternalLink,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useInvoices } from "@/hooks/useInvoices";
import { receiptService, paymentService } from "@/services/payment.service";
import { invoiceService } from "@/services/invoice.service";
import { formatCurrency, cn, formatDate } from "@/lib/utils";
import type { Invoice, InvoiceStatus, PaymentMode } from "@/types";
import { PageTransition } from "@/components/shared/page-transition";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const statusVariant: Record<
  InvoiceStatus,
  "success" | "warning" | "danger" | "info" | "secondary"
> = {
  Paid: "success",
  Pending: "warning",
  Partial: "info",
  Overdue: "danger",
  Cancelled: "secondary",
};

const methods: { label: PaymentMode; icon: typeof Smartphone }[] = [
  { label: "UPI", icon: Smartphone },
  { label: "Cash", icon: Banknote },
  { label: "Net Banking", icon: Building2 },
  { label: "Credit Card", icon: CreditCard },
  { label: "Cheque", icon: Wallet },
];

const MONTHS = [
  "01", "02", "03", "04", "05", "06",
  "07", "08", "09", "10", "11", "12",
];

type DeskTab = "dues" | "receipts" | "all";

export default function PaymentsPage() {
  const { society } = useAuth();
  const actor = society?.adminName ?? "Admin";
  const { invoices, refresh } = useInvoices(society?.id);
  const [view, setView] = useState<"monthly" | "annual">("monthly");
  const [month, setMonth] = useState("2026-07");
  const [year, setYear] = useState(2026);
  const [tab, setTab] = useState<DeskTab>("dues");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [receiptTick, setReceiptTick] = useState(0);
  const [collecting, setCollecting] = useState<Invoice | null>(null);
  const [payMode, setPayMode] = useState<PaymentMode>("UPI");
  const [payAmount, setPayAmount] = useState("");
  const [payError, setPayError] = useState<string | null>(null);

  const allReceipts = useMemo(() => {
    if (!society) return [];
    void receiptTick;
    return receiptService.list(society.id);
  }, [society, receiptTick]);

  const availableYears = useMemo(() => {
    const values = [
      ...invoices.map((invoice) => invoice.year),
      ...allReceipts.map((receipt) => {
        const m = receipt.month ?? "";
        return /^\d{4}/.test(m) ? Number(m.slice(0, 4)) : NaN;
      }),
    ].filter(Number.isFinite);
    return [...new Set(values)].sort((a, b) => b - a);
  }, [invoices, allReceipts]);

  const periodInvoices = useMemo(() => {
    const active = invoices.filter((i) => i.status !== "Cancelled");
    if (view === "monthly") return active.filter((p) => p.month === month);
    return active.filter((p) => p.year === year);
  }, [invoices, view, month, year]);

  const dues = useMemo(
    () =>
      periodInvoices.filter(
        (i) => i.outstanding > 0 && i.status !== "Paid"
      ),
    [periodInvoices]
  );

  const receipts = useMemo(() => {
    if (view === "monthly")
      return allReceipts.filter((r) => r.month === month);
    return allReceipts.filter((r) => r.month.startsWith(String(year)));
  }, [allReceipts, view, month, year]);

  const stats = useMemo(() => {
    if (!society) {
      return {
        expected: 0,
        collected: 0,
        outstanding: 0,
        percent: 0,
        pendingFlats: 0,
        partial: 0,
        late: 0,
        todayCollection: 0,
      };
    }
    if (view === "monthly") return invoiceService.stats(society.id, month);
    const list = periodInvoices;
    const expected = list.reduce((s, i) => s + i.totalAmount, 0);
    const collected = list.reduce((s, i) => s + i.paidAmount, 0);
    const outstanding = list.reduce((s, i) => s + i.outstanding, 0);
    return {
      expected,
      collected,
      outstanding,
      percent: expected ? Math.round((collected / expected) * 100) : 0,
      pendingFlats: list.filter(
        (i) => i.status === "Pending" || i.status === "Overdue"
      ).length,
      partial: list.filter((i) => i.status === "Partial").length,
      late: list.filter((i) => i.status === "Overdue" || i.lateFee > 0).length,
      todayCollection: invoiceService.stats(society.id).todayCollection,
    };
  }, [society, view, month, periodInvoices]);

  const filteredList = useMemo(() => {
    const base =
      tab === "dues"
        ? dues
        : tab === "all"
          ? periodInvoices
          : [];
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (i) =>
        i.invoiceNo.toLowerCase().includes(q) ||
        i.ownerName.toLowerCase().includes(q) ||
        `${i.wing}-${i.flatNo}`.toLowerCase().includes(q)
    );
  }, [tab, dues, periodInvoices, query]);

  const filteredReceipts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter(
      (r) =>
        r.receiptNo.toLowerCase().includes(q) ||
        r.ownerName.toLowerCase().includes(q) ||
        `${r.wing}-${r.flatNo}`.toLowerCase().includes(q) ||
        r.invoiceNo.toLowerCase().includes(q)
    );
  }, [receipts, query]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const openCollect = (inv: Invoice) => {
    setCollecting(inv);
    setPayAmount(String(inv.outstanding));
    setPayMode("UPI");
    setPayError(null);
  };

  const submitCollect = async () => {
    if (!collecting) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setPayError("Enter a valid amount");
      return;
    }
    if (amount > collecting.outstanding) {
      setPayError("Amount cannot exceed outstanding");
      return;
    }
    try {
      const result = await paymentService.simulatePay(
        collecting.invoiceNo,
        amount,
        payMode,
        actor
      );
      await refresh();
      setReceiptTick((t) => t + 1);
      setCollecting(null);
      flash(
        `Recorded ${formatCurrency(result.receipt.amount)} · ${result.receipt.receiptNo}`
      );
      setTab("receipts");
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Payment failed");
    }
  };

  const exportCsv = () => {
    const rows = [
      ["Invoice", "Flat", "Owner", "Total", "Paid", "Outstanding", "Status", "Due"],
      ...periodInvoices.map((p) => [
        p.invoiceNo,
        `${p.wing}-${p.flatNo}`,
        p.ownerName,
        String(p.totalAmount),
        String(p.paidAmount),
        String(p.outstanding),
        p.status,
        p.dueDate,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `collection-${view === "monthly" ? month : year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!society) return null;

  const periodLabel =
    view === "monthly" ? formatMonthLabel(month) : String(year);

  return (
    <PageTransition>
      <PageHeader
        eyebrow={society.name}
        title="Payments & collections"
        description="Record cash, UPI and bank payments — receipts sync to the resident app"
        actions={
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-2xl border border-input bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setView("monthly")}
                  className={cn(
                    "rounded-[14px] px-3 py-1.5 text-sm font-medium transition-colors",
                    view === "monthly"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setView("annual")}
                  className={cn(
                    "rounded-[14px] px-3 py-1.5 text-sm font-medium transition-colors",
                    view === "annual"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Annual
                </button>
              </div>
              <NativeSelect
                fieldSize="filter"
                value={year}
                onChange={(e) => {
                  const nextYear = Number(e.target.value);
                  setYear(nextYear);
                  setMonth(`${nextYear}-${month.slice(5, 7)}`);
                }}
                aria-label="Filter by year"
              >
                {availableYears.map((availableYear) => (
                  <option key={availableYear} value={availableYear}>
                    {availableYear}
                  </option>
                ))}
              </NativeSelect>
              {view === "monthly" ? (
                <NativeSelect
                  fieldSize="filter"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  aria-label="Filter by month"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={`${year}-${m}`}>
                      {formatMonthLabel(`${year}-${m}`)}
                    </option>
                  ))}
                </NativeSelect>
              ) : null}
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/invoices">Invoices</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </>
        }
      />

      {toast && (
        <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {toast}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Expected", value: formatCurrency(stats.expected) },
          { label: "Collected", value: formatCurrency(stats.collected) },
          { label: "Outstanding", value: formatCurrency(stats.outstanding) },
          { label: "Collection %", value: `${stats.percent}%` },
          { label: "Pending flats", value: String(stats.pendingFlats) },
          { label: "Partial", value: String(stats.partial) },
          { label: "Late / overdue", value: String(stats.late) },
          {
            label: "Today's collection",
            value: formatCurrency(stats.todayCollection),
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-caption text-muted-foreground">
                {s.label}
                {s.label === "Collected" ? ` · ${periodLabel}` : ""}
              </p>
              <p className="mt-1.5 truncate text-base font-bold sm:text-lg">
                {s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-4 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1 rounded-2xl bg-secondary/70 p-1">
            {(
              [
                { id: "dues" as const, label: `Dues (${dues.length})` },
                { id: "receipts" as const, label: `Receipts (${receipts.length})` },
                { id: "all" as const, label: `All (${periodInvoices.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                  tab === t.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              fieldSize="filter"
              className="pl-9"
              placeholder="Search flat, owner, invoice…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {tab !== "receipts" && (
            <>
              {filteredList.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {tab === "dues"
                    ? "No outstanding dues for this period."
                    : "No invoices for this period."}
                </p>
              ) : (
                filteredList.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-700">
                        {p.wing}-{p.flatNo}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{p.ownerName}</p>
                        <p className="mt-0.5 text-caption text-muted-foreground">
                          {p.invoiceNo} · Due {formatDate(p.dueDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <div className="mr-1 text-right">
                        <p className="font-bold">
                          {formatCurrency(
                            p.outstanding > 0 ? p.outstanding : p.totalAmount
                          )}
                        </p>
                        <p className="text-caption text-muted-foreground">
                          {p.outstanding > 0 ? "Outstanding" : "Paid"}
                        </p>
                      </div>
                      <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
                      <Link
                        href={`/invoice/${p.invoiceNo}`}
                        target="_blank"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary"
                        title="Open invoice"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                      {p.outstanding > 0 ? (
                        <Button size="sm" onClick={() => openCollect(p)}>
                          Record payment
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {tab === "receipts" && (
            <>
              {!filteredReceipts.length ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No receipts for this period. Record a payment from Dues.
                </p>
              ) : (
                filteredReceipts.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 border-l-4 border-l-emerald-500 bg-card p-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{r.receiptNo}</p>
                      <p className="text-caption text-muted-foreground">
                        {r.wing}-{r.flatNo} · {r.ownerName} ·{" "}
                        {formatDate(r.paymentDate)} · {r.paymentMode}
                      </p>
                    </div>
                    <p className="font-bold">{formatCurrency(r.amount)}</p>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/receipt/${r.receiptNo}`} target="_blank">
                        Open
                      </Link>
                    </Button>
                  </div>
                ))
              )}
            </>
          )}
        </CardContent>
      </Card>

      {collecting && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/20 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <Card className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border shadow-xl sm:rounded-2xl">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Record payment</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {collecting.wing}-{collecting.flatNo} · {collecting.ownerName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {collecting.invoiceNo} · Outstanding{" "}
                  <strong className="text-red-600">
                    {formatCurrency(collecting.outstanding)}
                  </strong>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCollecting(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Amount received
                </label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPayAmount(String(collecting.outstanding))
                    }
                  >
                    Full due
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPayAmount(
                        String(Math.round(collecting.outstanding / 2))
                      )
                    }
                  >
                    Half
                  </Button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Payment mode
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {methods.map((m) => (
                    <button
                      key={m.label}
                      type="button"
                      onClick={() => setPayMode(m.label)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                        payMode === m.label
                          ? "border-primary bg-indigo-50 text-primary"
                          : "border-border hover:bg-secondary/60"
                      )}
                    >
                      <m.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate font-medium">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {payError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                  {payError}
                </p>
              )}
              <Button className="w-full" onClick={submitCollect}>
                Confirm & generate receipt
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </PageTransition>
  );
}

function formatMonthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const names = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${names[Number(m) - 1]} ${y}`;
}
