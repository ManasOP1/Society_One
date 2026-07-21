"use client";

import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { recentPayments } from "@/data/mock";
import { formatCurrency } from "@/lib/utils";
import type { PaymentStatus } from "@/data/mock";

const statusVariant: Record<PaymentStatus, "success" | "warning" | "danger"> = {
  Paid: "success",
  Pending: "warning",
  Failed: "danger",
};

export function RecentPayments() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Recent Payments</CardTitle>
        <button className="text-xs font-medium text-primary hover:underline">
          See All
        </button>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentPayments.map((payment) => (
          <div
            key={payment.id}
            className="flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-secondary/60"
          >
            <Avatar className="h-10 w-10">
              <AvatarFallback>{payment.avatar}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-primary">
                  {payment.flat}
                </span>
                <span className="truncate text-sm font-medium">{payment.name}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {formatCurrency(payment.amount)}
              </p>
            </div>
            <Badge variant={statusVariant[payment.status]}>{payment.status}</Badge>
            <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-accent">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
