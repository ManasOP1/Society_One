"use client";

import { cn } from "@/lib/utils";

/** Fast CSS enter — avoids layout jank from transforms */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("page-enter w-full min-w-0 space-y-7", className)}>
      {children}
    </div>
  );
}

export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("page-enter", className)}
      style={delay ? { animationDelay: `${Math.min(delay, 120)}ms` } : undefined}
    >
      {children}
    </div>
  );
}
