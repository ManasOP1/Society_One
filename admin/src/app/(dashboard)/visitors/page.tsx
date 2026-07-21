"use client";

import { useCallback, useEffect, useState } from "react";
import { Car, Clock, Trash2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { visitorService, type SocietyVisitor } from "@/services/visitor.service";
import { PageTransition } from "@/components/shared/page-transition";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function VisitorsPage() {
  const { society } = useAuth();
  const actor = society?.adminName ?? "Admin";
  const [visitors, setVisitors] = useState<SocietyVisitor[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!society) return;
    void visitorService.reload(society.id).then(() => {
      setVisitors(visitorService.list(society.id));
    });
  }, [society]);

  useEffect(() => {
    if (society) setVisitors(visitorService.list(society.id));
  }, [society?.id]);

  useLiveRefresh(refresh, !!society?.id, { scope: "visitors", immediate: false });

  if (!society) return null;

  return (
    <PageTransition>
      <PageHeader
        eyebrow={society.name}
        title="Visitors"
        description="Visitor entries stored from the connected external app."
      />

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Visitor log ({visitors.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {visitors.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{v.name}</p>
                  <Badge variant="secondary">{v.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Flat {v.flat} · {v.purpose}
                  {v.phone ? ` · ${v.phone}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Car className="h-3.5 w-3.5" /> {v.vehicle}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {v.expectedTime}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm(`Remove ${v.name}?`)) {
                      setError(null);
                      void visitorService.remove(v.id, actor).then(
                        () => refresh(),
                        (e) => {
                          setError(e instanceof Error ? e.message : "Could not delete visitor");
                          refresh();
                        }
                      );
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {!visitors.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No visitor entries yet. Records from the other app will appear here.
            </p>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}
