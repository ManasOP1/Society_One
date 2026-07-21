"use client";

import { useEffect, useState } from "react";
import { DashboardSkeleton } from "@/components/shared/skeleton";

export function LoadingGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return <DashboardSkeleton />;
  return <>{children}</>;
}
