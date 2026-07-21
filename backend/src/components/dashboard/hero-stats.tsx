"use client";

import Link from "next/link";
import { Plus, ArrowRight, Users, Building2, Wallet, AlertCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface HeroStatsProps {
  members: number;
  flatsOccupied: number;
  flatsTotal: number;
  fund: number;
  pending: number;
  collected: number;
  lateFee: number;
  pendingCount: number;
  memberRecords: number;
}

export function HeroStats({
  members,
  flatsOccupied,
  flatsTotal,
  fund,
  pending,
  collected,
  lateFee,
  memberRecords,
}: HeroStatsProps) {
  const memberCount = memberRecords > 0 ? memberRecords : members;
  const stats = [
    {
      title: "Members / Flats",
      value: String(memberCount),
      subtitle: `${flatsOccupied} / ${flatsTotal} flats occupied`,
      icon: Users,
      className: "bg-gradient-to-br from-[#A78BFA] to-[#8B7CF6]",
      href: "/members",
      action: "plus" as const,
    },
    {
      title: "Collected this month",
      value: formatCurrency(collected),
      subtitle: `Late fees recorded: ${formatCurrency(lateFee)}`,
      icon: Wallet,
      className: "bg-gradient-to-br from-[#6EE7B7] to-[#6BCB9A]",
      href: "/payments",
      action: "arrow" as const,
    },
    {
      title: "Outstanding dues",
      value: formatCurrency(pending),
      subtitle: "Unpaid maintenance",
      icon: AlertCircle,
      className: "bg-gradient-to-br from-[#FDBA74] to-[#F5A962]",
      href: "/payments",
      action: "arrow" as const,
    },
    {
      title: "Society fund",
      value: formatCurrency(fund),
      subtitle: "Available balance",
      icon: Building2,
      className: "bg-gradient-to-br from-[#7DD3FC] to-[#38BDF8]",
      href: "/finance",
      action: "arrow" as const,
    },
  ];

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Link
            key={stat.title}
            href={stat.href}
            className={cn(
              "group relative flex min-h-[110px] min-w-0 flex-col justify-between overflow-hidden rounded-2xl p-4 text-white transition-shadow hover:shadow-lg sm:min-h-[120px] sm:p-5",
              stat.className
            )}
          >
            <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
            <div className="relative flex items-start justify-between gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20 sm:h-9 sm:w-9">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.75} />
              </div>
              <span className="max-w-[70%] truncate rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium sm:text-[11px]">
                {stat.title}
              </span>
            </div>
            <div className="relative mt-3 flex items-end justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold tracking-tight sm:text-2xl">
                  {stat.value}
                </p>
                <p className="truncate text-xs text-white/80 sm:text-sm">
                  {stat.subtitle}
                </p>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/25">
                {stat.action === "plus" ? (
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                )}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
