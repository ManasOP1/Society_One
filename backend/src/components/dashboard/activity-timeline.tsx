"use client";

import {
  CreditCard,
  UserCheck,
  MessageSquare,
  Megaphone,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { activities } from "@/data/mock";
import { cn } from "@/lib/utils";

const typeConfig = {
  payment: { icon: CreditCard, color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300" },
  visitor: { icon: UserCheck, color: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300" },
  complaint: { icon: MessageSquare, color: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300" },
  notice: { icon: Megaphone, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300" },
  event: { icon: Calendar, color: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300" },
};

export function ActivityTimeline() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activities</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {activities.map((activity, i) => {
            const config = typeConfig[activity.type];
            const Icon = config.icon;
            const isLast = i === activities.length - 1;

            return (
              <div key={activity.id} className="relative flex gap-3 pb-5 last:pb-0">
                {!isLast && (
                  <div className="absolute left-[17px] top-9 h-[calc(100%-20px)] w-px bg-border" />
                )}
                <div
                  className={cn(
                    "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    config.color
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{activity.title}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {activity.time}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {activity.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
