"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useAuth } from "@/context/auth-context";

export function MembersRatio() {
  const { members } = useAuth();

  const data = useMemo(() => {
    const owners = members.filter(
      (m) => !m.tenant || m.tenant === "—" || m.tenant.trim() === ""
    ).length;
    const tenants = Math.max(0, members.length - owners);
    const total = members.length || 1;
    return [
      {
        name: "Owner-occupied",
        value: Math.round((owners / total) * 100),
        count: owners,
        color: "#4F46E5",
      },
      {
        name: "With tenant",
        value: Math.round((tenants / total) * 100),
        count: tenants,
        color: "#38BDF8",
      },
    ];
  }, [members]);

  return (
    <div className="h-full min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
          Occupancy mix
        </h3>
        <Link
          href="/members"
          className="text-xs font-semibold text-[#4F46E5] hover:underline"
        >
          Members →
        </Link>
      </div>
      {members.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No members yet.</p>
      ) : (
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-3">
            {data.map((item) => (
              <div key={item.name} className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-slate-500">{item.name}</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {item.count} ({item.value}%)
                </span>
              </div>
            ))}
          </div>
          <div className="mx-auto h-[140px] w-[140px] shrink-0 sm:ml-auto sm:mr-0">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={3}
                  dataKey="count"
                  stroke="none"
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
