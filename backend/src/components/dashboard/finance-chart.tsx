"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";

interface FinanceChartProps {
  data: { month: string; collection: number; expense: number }[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-1.5 text-xs font-semibold text-slate-500">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-sm font-medium" style={{ color: p.color }}>
          {p.name}: ₹{Number(p.value).toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
}

export function FinanceChart({ data }: FinanceChartProps) {
  return (
    <div className="flex min-h-[280px] min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:min-h-[340px] sm:p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2 sm:mb-4 sm:gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-slate-900 dark:text-white sm:text-[15px]">
            Monthly collection analysis
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Maintenance collected vs expenses for this society
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#4F46E5]" />
              Collection
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FB923C]" />
              Expense
            </span>
          </div>
          <Link
            href="/finance"
            className="text-xs font-semibold text-[#4F46E5] hover:underline"
          >
            Details →
          </Link>
        </div>
      </div>

      <div className="h-[220px] w-full min-w-0 sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="raisedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#4F46E5" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FB923C" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#FB923C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 12 }}
              dy={6}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 12 }}
              tickFormatter={(v) => `₹${v / 1000}k`}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="collection"
              name="Collection"
              stroke="#4F46E5"
              strokeWidth={2.5}
              fill="url(#raisedFill)"
              dot={false}
              activeDot={{ r: 5, fill: "#4F46E5", strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="expense"
              name="Expense"
              stroke="#FB923C"
              strokeWidth={2.5}
              fill="url(#expenseFill)"
              dot={false}
              activeDot={{ r: 5, fill: "#FB923C", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
