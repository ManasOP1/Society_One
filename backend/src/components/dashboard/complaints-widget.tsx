"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { latestComplaints } from "@/data/mock";
import type { Priority, ComplaintStatus } from "@/data/mock";

const priorityVariant: Record<Priority, "info" | "warning" | "danger" | "purple"> = {
  Low: "info",
  Medium: "warning",
  High: "danger",
  Critical: "purple",
};

const statusVariant: Record<
  ComplaintStatus,
  "warning" | "info" | "success" | "danger"
> = {
  Open: "warning",
  "In Progress": "info",
  Resolved: "success",
  Rejected: "danger",
};

export function ComplaintsWidget() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Latest Complaints</CardTitle>
        <button className="text-xs font-medium text-primary hover:underline">
          See All
        </button>
      </CardHeader>
      <CardContent className="space-y-3">
        {latestComplaints.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl border border-border/60 p-3.5 transition-colors hover:bg-secondary/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{c.issue}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {c.resident} · Flat {c.flat}
                </p>
              </div>
              <Badge variant={priorityVariant[c.priority]}>{c.priority}</Badge>
            </div>
            <div className="mt-2">
              <Badge variant={statusVariant[c.status]}>{c.status}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
