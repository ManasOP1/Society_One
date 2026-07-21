"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { notices } from "@/data/mock";

export function NoticesWidget() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Latest Notices</CardTitle>
        <Link
          href="/notices"
          className="text-xs font-medium text-primary hover:underline"
        >
          See All
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className="group rounded-2xl border border-border/60 p-3.5 transition-all hover:border-primary/30 hover:bg-accent/40"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold">{notice.title}</h4>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {notice.date}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
              {notice.excerpt}
            </p>
            <button className="mt-2 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Read More <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
