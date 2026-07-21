"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  TrendingDown,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import * as XLSX from "xlsx";
import { PageTransition, FadeIn } from "@/components/shared/page-transition";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { financeSummary } from "@/data/mock";
import { financialBySociety } from "@/data/societies";
import { useAuth } from "@/context/auth-context";
import { expenseService } from "@/services/expense.service";
import { invoiceService } from "@/services/invoice.service";
import { formatCurrency } from "@/lib/utils";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import type { Expense } from "@/types";

type ExpenseForm = {
  category: string;
  vendor: string;
  amount: string;
  expenseDate: string;
  billName: string;
  remarks: string;
};

const emptyForm: ExpenseForm = {
  category: "Utilities",
  vendor: "",
  amount: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  billName: "",
  remarks: "",
};

export default function FinancePage() {
  const { society } = useAuth();
  const actor = society?.adminName ?? "Admin";
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    if (society) setExpenses(expenseService.list(society.id));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [society?.id]);

  const financialData = society ? financialBySociety[society.id] ?? [] : [];
  const income = financeSummary
    .filter((f) => f.type === "income")
    .reduce((s, f) => s + f.amount, 0);

  const expenseTotal = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0),
    [expenses]
  );

  const monthStats = society
    ? invoiceService.stats(society.id, "2026-07")
    : null;

  const exportExpenses = () => {
    const rows = expenses.map((e) => ({
      Date: e.expenseDate,
      Category: e.category,
      Vendor: e.vendor,
      Amount: e.amount,
      Bill: e.billName,
      Remarks: e.remarks,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `${society?.name ?? "society"}-expenses.xlsx`);
  };

  const onSave = () => {
    if (!society) return;
    const amount = Number(form.amount);
    if (!form.vendor.trim()) {
      setError("Vendor is required");
      return;
    }
    if (!amount || amount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setError(null);
    const payload = {
      category: form.category,
      vendor: form.vendor.trim(),
      amount,
      expenseDate: form.expenseDate,
      billName: form.billName || "mock-bill.pdf",
      remarks: form.remarks,
    };
    if (editing) {
      expenseService.update(editing.id, payload, actor);
    } else {
      expenseService.create(society.id, payload, actor);
    }
    setForm(emptyForm);
    setEditing(null);
    setShowForm(false);
    refresh();
  };

  if (!society) return null;

  return (
    <PageTransition>
      <PageHeader
        eyebrow={society.name}
        title="Finance"
        description="Society fund overview & expense ledger — collections live under Payments"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportExpenses}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add Expense
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Society Fund",
            value: society.societyFund,
            icon: TrendingUp,
            color: "text-emerald-600",
          },
          {
            label: "Collected (month)",
            value: monthStats?.collected ?? society.collectedThisMonth,
            icon: TrendingUp,
            color: "text-indigo-600",
          },
          {
            label: "Pending maintenance",
            value: monthStats?.outstanding ?? society.pendingMaintenance,
            icon: TrendingDown,
            color: "text-orange-600",
          },
          {
            label: "Expenses (recorded)",
            value: expenseTotal,
            icon: TrendingDown,
            color: "text-sky-600",
          },
        ].map((item, i) => (
          <FadeIn key={item.label} delay={i * 0.05}>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`rounded-2xl bg-secondary p-3 ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-lg font-bold">
                    <AnimatedCounter
                      value={item.value}
                      format={(n) => formatCurrency(n)}
                    />
                  </p>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <FadeIn delay={0.15} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Income vs Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `₹${v / 1000}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 16,
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                      }}
                      formatter={(v) => [
                        `₹${Number(v).toLocaleString("en-IN")}`,
                        "",
                      ]}
                    />
                    <Legend />
                    <Bar
                      dataKey="collection"
                      name="Income"
                      fill="#4F46E5"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar
                      dataKey="expense"
                      name="Expense"
                      fill="#FB923C"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.2}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {financeSummary.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl bg-secondary/50 px-3.5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <Badge
                      variant={item.type === "income" ? "success" : "warning"}
                      className="mt-1"
                    >
                      {item.type}
                    </Badge>
                  </div>
                  <p className="text-sm font-bold">
                    {formatCurrency(item.amount)}
                  </p>
                </div>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">
                Net (demo chart): {formatCurrency(income - expenseTotal)} · Live
                expenses: {formatCurrency(expenseTotal)}
              </p>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Expenses ({expenses.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={exportExpenses}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="px-2 py-3">Date</th>
                <th className="px-2 py-3">Category</th>
                <th className="px-2 py-3">Vendor</th>
                <th className="px-2 py-3">Amount</th>
                <th className="px-2 py-3">Bill</th>
                <th className="px-2 py-3">Remarks</th>
                <th className="px-2 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border/50 hover:bg-secondary/40"
                >
                  <td className="px-2 py-3">{e.expenseDate}</td>
                  <td className="px-2 py-3">
                    <Badge variant="secondary">{e.category}</Badge>
                  </td>
                  <td className="px-2 py-3 font-medium">{e.vendor}</td>
                  <td className="px-2 py-3 font-bold">
                    {formatCurrency(e.amount)}
                  </td>
                  <td className="px-2 py-3 text-xs text-muted-foreground">
                    {e.billName || "—"}
                  </td>
                  <td className="px-2 py-3 text-muted-foreground">
                    {e.remarks || "—"}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditing(e);
                          setForm({
                            category: e.category,
                            vendor: e.vendor,
                            amount: String(e.amount),
                            expenseDate: e.expenseDate,
                            billName: e.billName,
                            remarks: e.remarks,
                          });
                          setShowForm(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm(`Delete expense for ${e.vendor}?`)) {
                            const ok = expenseService.remove(e.id, actor);
                            if (ok) {
                              refresh();
                            } else {
                              setError("Could not delete expense");
                            }
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
          {!expenses.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No expenses yet. Click Add Expense.
            </p>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>
                {editing ? "Edit expense" : "Add expense"}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Category
                </label>
                <select
                  className="flex h-10 w-full rounded-2xl border border-input bg-card px-3 text-sm"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                >
                  {expenseService.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Vendor
                </label>
                <Input
                  value={form.vendor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vendor: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Amount
                  </label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Expense date
                  </label>
                  <Input
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, expenseDate: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Bill upload (mock)
                </label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setForm((f) => ({
                      ...f,
                      billName: file?.name ?? "mock-bill.pdf",
                    }));
                  }}
                />
                {form.billName && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Attached: {form.billName}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Remarks
                </label>
                <Input
                  value={form.remarks}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, remarks: e.target.value }))
                  }
                />
              </div>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <Button onClick={onSave}>
                {editing ? "Update expense" : "Save expense"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </PageTransition>
  );
}
