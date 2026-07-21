"use client";

import { Plus, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { societyInfo } from "@/data/mock";

const stats = [
  {
    label: "Members",
    sublabel: "Total Members",
    value: societyInfo.totalMembers,
    format: (n: number) => n.toString(),
    gradient: "gradient-purple",
    emoji: "👥",
    action: "plus" as const,
  },
  {
    label: "Flats",
    sublabel: "Occupied Flats",
    value: societyInfo.occupiedFlats,
    format: (n: number) => `${n} / ${societyInfo.totalFlats}`,
    gradient: "gradient-orange",
    emoji: "🏠",
    action: "plus" as const,
  },
  {
    label: "Society Fund",
    sublabel: "Total Balance",
    value: societyInfo.societyFund,
    format: (n: number) => formatCurrency(n),
    gradient: "gradient-mint",
    emoji: "💰",
    action: "refresh" as const,
  },
  {
    label: "Active Events",
    sublabel: "This Month",
    value: societyInfo.activeEvents,
    format: (n: number) => `${n} Events`,
    gradient: "gradient-sky",
    emoji: "📅",
    action: "plus" as const,
  },
  {
    label: "Pending Maintenance",
    sublabel: "Outstanding",
    value: societyInfo.pendingMaintenance,
    format: (n: number) => formatCurrency(n),
    gradient: "gradient-red",
    emoji: "📄",
    action: "plus" as const,
  },
];

export function StatsCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i, duration: 0.45 }}
          className={cn(
            "card-lift relative overflow-hidden rounded-[20px] p-5 text-white shadow-[var(--shadow-card)]",
            stat.gradient
          )}
        >
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
          <div className="absolute -bottom-6 -left-2 h-16 w-16 rounded-full bg-white/10" />

          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">
                {stat.emoji} {stat.label}
              </p>
              <p className="mt-3 text-2xl font-bold tracking-tight">
                <AnimatedCounter value={stat.value} format={stat.format} />
              </p>
              <p className="mt-1 text-xs text-white/70">{stat.sublabel}</p>
            </div>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-sm transition-transform hover:scale-110 hover:bg-white/35">
              {stat.action === "refresh" ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
