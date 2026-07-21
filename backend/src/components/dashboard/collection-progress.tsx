"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { societyInfo } from "@/data/mock";
import { formatCurrency } from "@/lib/utils";

export function CollectionProgress() {
  const percent = Math.round(
    (societyInfo.collected / societyInfo.collectionTarget) * 100
  );
  const data = [
    { name: "Collected", value: percent },
    { name: "Remaining", value: 100 - percent },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance Collection</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative mx-auto h-[180px] w-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={78}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                <Cell fill="#4F46E5" />
                <Cell fill="var(--muted)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatedCounter
              value={percent}
              suffix="%"
              className="text-3xl font-bold text-primary"
            />
            <span className="text-xs text-muted-foreground">Collected</span>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-center text-sm">
          <p className="text-muted-foreground">
            Target:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(societyInfo.collectionTarget)}
            </span>
          </p>
          <p className="text-muted-foreground">
            Collected:{" "}
            <span className="font-semibold text-emerald-600">
              {formatCurrency(societyInfo.collected)}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
