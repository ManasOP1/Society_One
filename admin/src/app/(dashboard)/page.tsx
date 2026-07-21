"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useAuth } from "@/context/auth-context";
import { financialBySociety } from "@/data/societies";
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

export default function DashboardPage() {
  const { society, members } = useAuth();
  const today = format(new Date(), "EEEE, d MMMM yyyy");

  if (!society) return null;

  const billingMonth = "2026-07";
  const stats = invoiceService.stats(society.id, billingMonth);
  const chartData = financialBySociety[society.id] ?? [];

  return (
    <PageTransition>
      <PageHeader
        eyebrow={society.name}
        title={`Welcome back, ${society.adminName.split(" ")[0]}`}
        description={society.address}
        actions={
          <div className="rounded-xl border border-border bg-card px-4 py-2.5 shadow-[var(--shadow-card)]">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Today
            </p>
            <p className="text-sm font-semibold text-foreground">{today}</p>
          </div>
        }
      />

      <HeroStats
        members={members.length || society.totalMembers}
        flatsOccupied={society.occupiedFlats}
        flatsTotal={society.totalFlats}
        fund={society.societyFund}
        pending={stats.outstanding || society.pendingMaintenance}
        collected={stats.collected || society.collectedThisMonth}
        lateFee={society.lateFeeTotal}
        pendingCount={stats.pendingFlats}
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
