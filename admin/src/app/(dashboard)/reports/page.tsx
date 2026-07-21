"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  PieChart,
  TrendingUp,
  ClipboardCheck,
  FileText,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { invoiceService } from "@/services/invoice.service";
import { receiptService } from "@/services/payment.service";
import { expenseService } from "@/services/expense.service";
import { auditService } from "@/services/audit.service";
import { PageTransition, FadeIn } from "@/components/shared/page-transition";
import { PageHeader } from "@/components/shared/page-header";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { printElementById } from "@/utils/print";

type Row = Record<string, string | number>;

function downloadExcel(rows: Row[], sheetName: string, filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

function downloadCsv(rows: Row[], filename: string) {
  if (!rows.length) {
    const blob = new Blob([""], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const cols = Object.keys(rows[0]);
  const header = cols.join(",");
  const body = rows
    .map((row) =>
      cols
        .map((col) => {
          const str = String(row[col] ?? "");
          return str.includes(",") ? `"${str}"` : str;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { society, members } = useAuth();
  const [month, setMonth] = useState("2026-07");
  const [year, setYear] = useState(2026);

  const collectionRows = useMemo(() => {
    if (!society) return [] as Row[];
    const receipts = receiptService.list(society.id).filter((r) => {
      if (r.month === month) return true;
      return r.month.startsWith(String(year));
    });
    return receipts
      .filter((r) => r.month === month)
      .map((r) => ({
        "Receipt No": r.receiptNo,
        "Invoice No": r.invoiceNo,
        Wing: r.wing,
        Flat: r.flatNo,
        Owner: r.ownerName,
        Amount: r.amount,
        "Late Fee": r.lateFee,
        "Payment Date": r.paymentDate,
        Mode: r.paymentMode,
        UTR: r.utr,
        Bank: r.bank,
      }));
  }, [society, month, year]);

  const outstandingRows = useMemo(() => {
    if (!society) return [] as Row[];
    return invoiceService
      .list(society.id)
      .filter(
        (i) =>
          i.month === month &&
          i.status !== "Cancelled" &&
          i.outstanding > 0
      )
      .map((i) => ({
        "Invoice No": i.invoiceNo,
        Wing: i.wing,
        Flat: i.flatNo,
        Owner: i.ownerName,
        Total: i.totalAmount,
        Paid: i.paidAmount,
        Outstanding: i.outstanding,
        Status: i.status,
        "Due Date": i.dueDate,
      }));
  }, [society, month]);

  const expenseRows = useMemo(() => {
    if (!society) return [] as Row[];
    return expenseService
      .list(society.id)
      .filter((e) => e.expenseDate.startsWith(month))
      .map((e) => ({
        Date: e.expenseDate,
        Category: e.category,
        Vendor: e.vendor,
        Amount: e.amount,
        Bill: e.billName,
        Remarks: e.remarks,
      }));
  }, [society, month]);

  const memberRows = useMemo(
    () =>
      members.map((m) => ({
        Wing: m.wing,
        Flat: m.flat,
        Owner: m.owner,
        Phone: m.phone,
        Email: m.email,
        Parking: m.parking,
        Maintenance: m.maintenance,
      })),
    [members]
  );

  const auditRows = useMemo(() => {
    if (!society) return [] as Row[];
    return auditService.list(society.id).map((a) => ({
      Time: a.createdAt,
      Action: a.action,
      Entity: `${a.entityType}/${a.entityId}`,
      Details: a.details,
      Actor: a.actor,
    }));
  }, [society]);

  const yearCollectionRows = useMemo(() => {
    if (!society) return [] as Row[];
    return receiptService
      .list(society.id)
      .filter((r) => r.month.startsWith(String(year)))
      .map((r) => ({
        "Receipt No": r.receiptNo,
        "Invoice No": r.invoiceNo,
        Month: r.month,
        Wing: r.wing,
        Flat: r.flatNo,
        Owner: r.ownerName,
        Amount: r.amount,
        Mode: r.paymentMode,
        UTR: r.utr,
      }));
  }, [society, year]);

  if (!society) return null;

  const stats = invoiceService.stats(society.id, month);

  const reports = [
    {
      title: "Collection Report",
      desc: "Receipt-wise monthly collections with UTR & mode",
      icon: Calendar,
      color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
      rows: collectionRows,
      sheet: "Collection",
      file: `${society.name}-collection-${month}`,
    },
    {
      title: "Outstanding Report",
      desc: "Unpaid / partial invoices for the selected month",
      icon: TrendingUp,
      color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
      rows: outstandingRows,
      sheet: "Outstanding",
      file: `${society.name}-outstanding-${month}`,
    },
    {
      title: "Expense Report",
      desc: "Society expenses by category, vendor & bill",
      icon: FileText,
      color: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
      rows: expenseRows,
      sheet: "Expenses",
      file: `${society.name}-expense-${month}`,
    },
    {
      title: "Member Report",
      desc: "Current member directory for this society",
      icon: Users,
      color: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300",
      rows: memberRows,
      sheet: "Members",
      file: `${society.name}-members`,
    },
    {
      title: "Audit Report",
      desc: "Action trail from localStorage audit log",
      icon: ClipboardCheck,
      color: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300",
      rows: auditRows,
      sheet: "Audit",
      file: `${society.name}-audit`,
    },
    {
      title: "Annual Collection",
      desc: "Full-year receipts for selected year",
      icon: PieChart,
      color: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
      rows: yearCollectionRows,
      sheet: "Annual",
      file: `${society.name}-annual-${year}`,
    },
  ];

  const preview = collectionRows.slice(0, 5) as Row[];
  const previewCols = preview[0] ? Object.keys(preview[0]) : [];

  return (
    <PageTransition>
      <PageHeader
        eyebrow={society.name}
        title="Society Fund Reports"
        description="Excel / CSV / PDF exports from invoices, receipts, expenses & audit"
      />

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Month</label>
          <NativeSelect
            fieldSize="filter"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            <option value="2026-07">Jul 2026</option>
            <option value="2026-06">Jun 2026</option>
            <option value="2025-12">Dec 2025</option>
          </NativeSelect>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Year</label>
          <NativeSelect
            fieldSize="filter"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </NativeSelect>
        </div>
        <div className="flex items-end gap-4 text-sm">
          <span>
            Collected:{" "}
            <strong className="text-emerald-600">
              {formatCurrency(stats.collected)}
            </strong>
          </span>
          <span>
            Outstanding:{" "}
            <strong className="text-red-600">
              {formatCurrency(stats.outstanding)}
            </strong>
          </span>
          <span>
            Collection: <strong>{stats.percent}%</strong>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report, i) => (
          <FadeIn key={report.title} delay={i * 0.04}>
            <Card>
              <CardHeader>
                <div
                  className={`mb-2 flex h-12 w-12 items-center justify-center rounded-2xl ${report.color}`}
                >
                  <report.icon className="h-6 w-6" />
                </div>
                <CardTitle>{report.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{report.desc}</p>
                <p className="text-xs text-slate-400">{report.rows.length} rows</p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  variant="soft"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    downloadExcel(
                      report.rows,
                      report.sheet,
                      `${report.file}.xlsx`
                    )
                  }
                >
                  <Download className="h-4 w-4" /> Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => downloadCsv(report.rows, `${report.file}.csv`)}
                >
                  <FileSpreadsheet className="h-4 w-4" /> CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const el = document.getElementById("report-print-root");
                    if (!el) return;
                    el.innerHTML = `<h2>${report.title}</h2><pre style="font-size:11px;white-space:pre-wrap">${JSON.stringify(report.rows.slice(0, 50), null, 2)}</pre>`;
                    printElementById("report-print-root", report.file);
                  }}
                >
                  PDF
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        ))}
      </div>

      <div id="report-print-root" className="hidden" />

      <Card>
        <CardHeader>
          <CardTitle>Collection preview ({month})</CardTitle>
          <p className="text-xs text-muted-foreground">
            From receiptService · public receipts at /receipt/REC-…
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead>
              <tr className="border-b">
                {previewCols.map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-2 py-2 font-semibold text-muted-foreground"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  {previewCols.map((col) => (
                    <td key={col} className="whitespace-nowrap px-2 py-2">
                      {String(row[col] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {preview.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No receipts for this month. Mark invoices paid or use Pay Now.
            </p>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}
