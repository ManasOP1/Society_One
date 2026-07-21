"use client";

import { useState } from "react";
import {
  Plus,
  UserPlus,
  FileText,
  Receipt,
  Megaphone,
  CalendarPlus,
  BarChart3,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const actions = [
  { label: "Members", icon: UserPlus, color: "bg-violet-500", href: "/members" },
  { label: "Invoices", icon: FileText, color: "bg-sky-500", href: "/invoices" },
  { label: "Payments", icon: Receipt, color: "bg-emerald-500", href: "/payments" },
  { label: "Notices", icon: Megaphone, color: "bg-indigo-500", href: "/notices" },
  { label: "Events", icon: CalendarPlus, color: "bg-primary", href: "/events" },
  { label: "Reports", icon: BarChart3, color: "bg-rose-500", href: "/reports" },
];

export function FloatingActions() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[45] flex flex-col items-end gap-2.5">
      {open &&
        actions.map((action) => {
          const Icon = action.icon;
          return (
            <a
              key={action.label}
              href={action.href}
              className="pointer-events-auto group flex items-center gap-2.5"
              onClick={() => setOpen(false)}
            >
              <span className="hidden rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium shadow-[var(--shadow-card)] sm:block">
                {action.label}
              </span>
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md transition-transform duration-150 group-hover:scale-105",
                  action.color
                )}
                title={action.label}
              >
                <Icon className="h-4 w-4" />
              </span>
            </a>
          );
        })}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-colors duration-150",
          open
            ? "bg-foreground text-background"
            : "bg-primary text-primary-foreground"
        )}
        aria-label="Quick links"
      >
        {open ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      </button>
    </div>
  );
}
