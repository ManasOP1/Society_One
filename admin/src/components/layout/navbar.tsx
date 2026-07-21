"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Settings,
  Search,
  Menu,
  X,
  Bell,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "@/components/shared/theme-provider";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const primaryLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/members", label: "Members" },
  { href: "/invoices", label: "Invoices" },
  { href: "/payments", label: "Payments" },
  { href: "/finance", label: "Finance" },
  { href: "/reports", label: "Reports" },
];

const moreLinks = [
  { href: "/events", label: "Events" },
  { href: "/notices", label: "Notices" },
  { href: "/visitors", label: "Visitors" },
  { href: "/settings", label: "Settings" },
];

function StarLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <path
        d="M16 2.5L19.2 12.2L29.5 12.8L21.4 18.9L24.2 29L16 23.2L7.8 29L10.6 18.9L2.5 12.8L12.8 12.2L16 2.5Z"
        fill="#4F46E5"
      />
      <path
        d="M16 11.5C14.2 11.5 13.2 12.6 13.2 14.2V15.8H11.8V21.5H20.2V15.8H18.8V14.2C18.8 12.6 17.8 11.5 16 11.5ZM16 13C16.7 13 17.2 13.4 17.2 14.2V15.8H14.8V14.2C14.8 13.4 15.3 13 16 13Z"
        fill="white"
      />
    </svg>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-[#E2E8F0]/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <StarLogo className="h-8 w-8" />
            <span className="hidden text-[17px] font-bold tracking-tight text-slate-900 sm:inline dark:text-white">
              Society<span className="text-[#4F46E5]">One</span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-0.5 xl:flex">
            {primaryLinks.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-[#4F46E5] text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search members, flats..."
                className="h-9 w-48 rounded-lg border-slate-200 bg-slate-50 pl-9 text-sm lg:w-56 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              className="relative h-9 w-9 text-slate-500"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#4F46E5]" />
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              className="h-9 w-9 text-slate-500"
              aria-label="Toggle theme"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              <Sun className="hidden h-4 w-4 dark:block" />
              <Moon className="h-4 w-4 dark:hidden" />
            </Button>

            <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block dark:bg-slate-700" />

            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jonathan&backgroundColor=b6e3f4" />
                <AvatarFallback className="bg-[#4F46E5] text-xs text-white">
                  JS
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left lg:block">
                <p className="text-[13px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
                  Jonathan Smith
                </p>
                <p className="text-[11px] leading-tight text-slate-400">Admin</p>
              </div>
              <Settings className="hidden h-4 w-4 text-slate-400 lg:block" />
            </Link>

            <Button
              variant="ghost"
              size="icon-sm"
              className="h-9 w-9 xl:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40 xl:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 z-[70] flex h-full w-72 flex-col bg-white p-5 shadow-2xl xl:hidden dark:bg-slate-900">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StarLogo className="h-7 w-7" />
                <span className="font-bold">SocietyOne</span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
              {[...primaryLinks, ...moreLinks].map((link) => {
                const active =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "rounded-lg px-4 py-2.5 text-sm font-medium",
                      active
                        ? "bg-[#4F46E5] text-white"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
