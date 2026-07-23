"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Download,
  Eye,
  CheckCircle2,
  Trash2,
  MessageCircle,
  Plus,
  Search,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useInvoices } from "@/hooks/useInvoices";
import { settingsService } from "@/services/settings.service";
import { whatsappService } from "@/services/whatsapp.service";
import { paymentService } from "@/services/payment.service";
import { invoiceService } from "@/services/invoice.service";
import { printElementById } from "@/utils/print";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice, InvoiceStatus } from "@/types";
import { PageTransition } from "@/components/shared/page-transition";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { InvoiceDocument } from "@/components/invoices/invoice-document";

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

export default function InvoicesPage() {
  const { society } = useAuth();
  const actor = society?.adminName ?? "Admin";
  const {
    invoices,
    generateMonthly,
    remove,
    refresh,
  } = useInvoices(society?.id);

  const [month, setMonth] = useState("2026-07");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "All">("All");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [reminder, setReminder] = useState<{
    message: string;
    count: number;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [settings, setSettings] = useState<ReturnType<
    typeof settingsService.get
  > | null>(null);

  useEffect(() => {
    if (!society) {
      setSettings(null);
      return;
    }
    setSettings(settingsService.get(society.id));
    void settingsService.fetch(society.id, { silent: true }).then(setSettings).catch(() => {
      setSettings(settingsService.get(society.id));
    });
  }, [society]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== "All" && inv.status !== statusFilter) return false;
      if (month && inv.month !== month) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        inv.invoiceNo.toLowerCase().includes(q) ||
        inv.ownerName.toLowerCase().includes(q) ||
        `${inv.wing}-${inv.flatNo}`.toLowerCase().includes(q)
      );
    });
  }, [invoices, month, query, statusFilter]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  if (!society) return null;

  const monthStats = invoiceService.stats(society.id, month);

  return (
    <PageTransition>
      <PageHeader
        eyebrow={society.name}
        title="Invoices"
        description="Create and manage billing documents — collect money from Payments"
        actions={
          <>
            <NativeSelect
              fieldSize="filter"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              <option value="2026-07">Jul 2026</option>
              <option value="2026-06">Jun 2026</option>
              <option value="2026-08">Aug 2026</option>
            </NativeSelect>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const created = await generateMonthly(month, actor);
                  flash(
                    created.length
                      ? `Generated ${created.length} invoice(s) for ${month}`
                      : `No new invoices — already generated for ${month}`
                  );
                } catch (e) {
                  flash(e instanceof Error ? e.message : "Failed to generate invoices");
                }
              }}
            >
              <Plus className="h-4 w-4" /> Generate Monthly
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const unpaid = invoices.filter(
                  (i) =>
                    i.month === month &&
                    i.status !== "Paid" &&
                    i.status !== "Cancelled" &&
                    i.outstanding > 0
                );
                if (!unpaid.length) {
                  flash("No unpaid invoices for this month");
                  return;
                }
                const preview = whatsappService.preview(unpaid[0], "reminder");
                setReminder({
                  message: preview.message,
                  count: unpaid.length,
                });
              }}
            >
              <MessageCircle className="h-4 w-4" /> Send Reminder
            </Button>
          </>
        }
      />

      {toast && (
        <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {toast}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Expected", value: formatCurrency(monthStats.expected) },
          { label: "Collected", value: formatCurrency(monthStats.collected) },
          { label: "Outstanding", value: formatCurrency(monthStats.outstanding) },
          { label: "Collection %", value: `${monthStats.percent}%` },
          { label: "Pending flats", value: String(monthStats.pendingFlats) },
          { label: "Partial", value: String(monthStats.partial) },
          { label: "Late / overdue", value: String(monthStats.late) },
          {
            label: "Today's collection",
            value: formatCurrency(monthStats.todayCollection),
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-caption text-muted-foreground">{s.label}</p>
              <p className="mt-1.5 truncate text-base font-bold sm:text-lg">
                {s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Invoice list ({filtered.length})</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                fieldSize="filter"
                className="w-full pl-9 sm:w-52"
                placeholder="Search invoice, flat, owner..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <NativeSelect
              fieldSize="filter"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as InvoiceStatus | "All")
              }
            >
              <option value="All">All status</option>
              <option value="Pending">Pending</option>
              <option value="Partial">Partial</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
              <option value="Cancelled">Cancelled</option>
            </NativeSelect>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="px-2 py-3">Invoice</th>
                <th className="px-2 py-3">Flat</th>
                <th className="px-2 py-3">Owner</th>
                <th className="px-2 py-3">Total</th>
                <th className="px-2 py-3">Paid</th>
                <th className="px-2 py-3">Due</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-border/50 hover:bg-secondary/40"
                >
                  <td className="px-2 py-3 font-semibold text-[#4F46E5]">
                    {inv.invoiceNo}
                  </td>
                  <td className="px-2 py-3">
                    {inv.wing}-{inv.flatNo}
                  </td>
                  <td className="px-2 py-3">{inv.ownerName}</td>
                  <td className="px-2 py-3">{formatCurrency(inv.totalAmount)}</td>
                  <td className="px-2 py-3">{formatCurrency(inv.paidAmount)}</td>
                  <td className="px-2 py-3">{formatDate(inv.dueDate)}</td>
                  <td className="px-2 py-3">
                    <Badge variant={statusVariant[inv.status]}>{inv.status}</Badge>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Preview"
                        onClick={() => {
                          void (async () => {
                            try {
                              const full = await invoiceService.fetchByNo(
                                inv.invoiceNo,
                                society?.id
                              );
                              setSelected(full);
                            } catch {
                              setSelected(inv);
                            }
                          })();
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Link
                        href={`/invoice/${inv.invoiceNo}`}
                        target="_blank"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent"
                        title="Public link"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Mark Paid"
                        onClick={async () => {
                          try {
                            if (inv.outstanding <= 0) {
                              flash(`${inv.invoiceNo} is already paid`);
                              return;
                            }
                            await paymentService.markFullyPaid(inv.invoiceNo, actor, "Cash");
                            await refresh();
                            flash(`Marked paid ${inv.invoiceNo}`);
                          } catch (e) {
                            flash(e instanceof Error ? e.message : "Payment failed");
                          }
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive"
                        title="Cancel / Delete"
                        onClick={() => {
                          if (confirm(`Cancel and remove ${inv.invoiceNo} from the ledger?`)) {
                            void remove(inv.invoiceNo, actor).then((ok) => {
                              if (ok) {
                                flash(`Cancelled ${inv.invoiceNo}`);
                                if (selected?.invoiceNo === inv.invoiceNo) {
                                  setSelected(null);
                                }
                              } else {
                                flash(`Could not cancel ${inv.invoiceNo}`);
                              }
                            });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No invoices for this filter. Click Generate Monthly.
            </p>
          )}
        </CardContent>
      </Card>

      {selected && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
          <div className="my-6 w-full max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-3 dark:bg-slate-900">
              <p className="text-sm font-semibold">{selected.invoiceNo}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTimeout(() => {
                      printElementById(
                        "invoice-print-root",
                        selected.invoiceNo
                      );
                    }, 50);
                  }}
                >
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/invoice/${selected.invoiceNo}`} target="_blank">
                    Open public page
                  </Link>
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>
            </div>
            <InvoiceDocument invoice={selected} settings={settings} />
          </div>
        </div>
      )}

      {reminder && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Reminder preview</CardTitle>
              <p className="text-sm text-muted-foreground">
                Will simulate WhatsApp to {reminder.count} unpaid flat(s). No real
                message is sent.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-xs dark:bg-slate-800">
                {reminder.message}
              </pre>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReminder(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const unpaid = invoices.filter(
                      (i) =>
                        i.month === month &&
                        i.status !== "Paid" &&
                        i.status !== "Cancelled" &&
                        i.outstanding > 0
                    );
                    whatsappService.sendRemindersForUnpaid(
                      society.id,
                      actor,
                      unpaid
                    );
                    setReminder(null);
                    flash(`Simulated reminders for ${unpaid.length} flat(s)`);
                  }}
                >
                  Confirm send (mock)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageTransition>
  );
}

