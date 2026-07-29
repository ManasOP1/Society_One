"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useEffect, useState, useTransition } from "react";
import { useAuth } from "@/context/auth-context";
import { dashboardApi, reportsApi } from "@/lib/api-client";
import { invoiceService } from "@/services/invoice.service";
import { HeroStats } from "@/components/dashboard/hero-stats";
import { FeaturedEvent } from "@/components/dashboard/featured-event";
import { CalendarWidget } from "@/components/dashboard/calendar-widget";
import { FinanceChart } from "@/components/dashboard/finance-chart";
import { MembersRatio } from "@/components/dashboard/members-ratio";
import { OutstandingDues } from "@/components/dashboard/outstanding-dues";
import { PageTransition } from "@/components/shared/page-transition";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

type DashboardSummary = {
  outstandingTotal: number;
  pendingInvoices: number;
};

type ChartPoint = { month: string; collection: number; expense: number };

/**
 * Methods: #6 #7 #16 #22 #24 #29
 * Hero + chart from summary DTOs — not client reduce of invoice/receipt caches.
 * Expected: first paint 1–2 RTTs; payload O(months) not O(invoices).
 */
export default function DashboardPage() {
  const { society, members } = useAuth();
  const today = format(new Date(), "EEEE, d MMMM yyyy");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!society) return;
    let cancelled = false;
    void Promise.all([
      dashboardApi.summary().catch(() => null),
      reportsApi.monthlySeries(society.id, 6).catch(() => null),
    ]).then(([dash, series]) => {
      if (cancelled) return;
      startTransition(() => {
        if (dash) {
          setSummary({
            outstandingTotal: Number(dash.outstandingTotal) || 0,
            pendingInvoices: Number(dash.pendingInvoices) || 0,
          });
        }
        if (series?.series?.length) {
          setChartData(
            series.series.map((row) => ({
              month: row.month.slice(5),
              collection: Math.round(row.collection),
              expense: Math.round(row.expense),
            }))
          );
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [society]);

  if (!society) return null;

  const billingMonth = format(new Date(), "yyyy-MM");
  const stats = invoiceService.stats(society.id, billingMonth);
  const pending = summary?.outstandingTotal ?? stats.outstanding ?? society.pendingMaintenance;
  const pendingCount = summary?.pendingInvoices ?? stats.pendingFlats;

  return (
    <PageTransition>
      <PageHeader
        eyebrow={society.name}
        title={`Welcome back, ${society.adminName.split(" ")[0]}`}
        description={society.address}
        actions={
          <div className="rounded-xl border border-border bg-card px-4 py-2.5 shadow-[var(--shadow-card)]">
            <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              Today
            </p>
            <p className="text-[0.9375rem] font-semibold text-foreground">{today}</p>
          </div>
        }
      />

      <HeroStats
        members={members.length || society.totalMembers}
        flatsOccupied={society.occupiedFlats}
        flatsTotal={society.totalFlats}
        fund={society.societyFund}
        pending={pending}
        collected={stats.collected || society.collectedThisMonth}
        lateFee={society.lateFeeTotal}
        pendingCount={pendingCount}
        memberRecords={members.length}
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-4 xl:col-span-3">
          <FeaturedEvent />
          <CalendarWidget />
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-8 xl:col-span-9">
          <FinanceChart data={chartData} />
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            <MembersRatio />
            <OutstandingDues />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link href="/invoices">Invoices</Link>
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link href="/payments">Collection desk</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/members">Members</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/reports">Reports</Link>
            </Button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
