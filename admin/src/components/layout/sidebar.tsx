"use client";

import { useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import {
  DashboardIcon,
  WalletIcon,
  UsersIcon,
  BellRingIcon,
  CreditCardIcon,
  UserCheckIcon,
  ChartBarIcon,
  SettingsIcon,
  ClipboardIcon,
  SparklesIcon,
  BadgeDollarIcon,
  type SparklesIconHandle,
} from "@animateicons/react/lucide";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import {
  useSidebar,
  SIDEBAR_EXPANDED,
  SIDEBAR_COLLAPSED,
} from "@/context/sidebar-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarNavItem } from "@/components/layout/sidebar-nav-item";

/** Ordered for real admin workflow: people → billing → money → ops */
const navItems = [
  { href: "/", label: "Dashboard", Icon: DashboardIcon },
  { href: "/members", label: "Members", Icon: UsersIcon },
  { href: "/invoices", label: "Invoices", Icon: BadgeDollarIcon },
  { href: "/payments", label: "Payments", Icon: CreditCardIcon },
  { href: "/finance", label: "Finance", Icon: WalletIcon },
  { href: "/reports", label: "Reports", Icon: ChartBarIcon },
  { href: "/events", label: "Events", Icon: ClipboardIcon },
  { href: "/notices", label: "Notices", Icon: BellRingIcon },
  { href: "/visitors", label: "Visitors", Icon: UserCheckIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { society, logout } = useAuth();
  const {
    expanded,
    isMobile,
    mobileOpen,
    setMobileOpen,
    onEnter,
    onLeave,
  } = useSidebar();
  const brandIconRef = useRef<SparklesIconHandle>(null);

  const open = isMobile ? mobileOpen : expanded;
  const width = isMobile
    ? SIDEBAR_EXPANDED
    : open
      ? SIDEBAR_EXPANDED
      : SIDEBAR_COLLAPSED;

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const initials =
    (society?.adminName ?? "A")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2) || "A";

  return (
    <>
      {isMobile && (
        <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
              SocietyOne
            </p>
            <p className="truncate text-[11px] text-slate-400">
              {society?.name}
            </p>
          </div>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-[#4F46E5] text-[10px] text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
        </header>
      )}

      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        style={{ width }}
        className={cn(
          "fixed left-0 top-0 z-50 flex h-dvh flex-col overflow-hidden border-r border-slate-200/80 bg-white transition-[width,transform] duration-200 ease-out dark:border-slate-800 dark:bg-slate-900",
          isMobile && !mobileOpen && "-translate-x-full",
          isMobile && mobileOpen && "translate-x-0 shadow-2xl"
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-slate-100 dark:border-slate-800",
            open ? "gap-3 px-3.5" : "justify-center"
          )}
          onMouseEnter={() => brandIconRef.current?.startAnimation()}
          onMouseLeave={() => brandIconRef.current?.stopAnimation()}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5] text-white [&>svg]:overflow-visible">
            <SparklesIcon
              ref={brandIconRef}
              size={16}
              color="#ffffff"
              isAnimated
            />
          </div>
          {open && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                SocietyOne
              </p>
              <p className="truncate text-[10px] text-slate-400">
                {society?.name ?? "Society"}
              </p>
            </div>
          )}
          {isMobile && open && (
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav
          className={cn(
            "flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden py-2",
            open ? "px-2.5" : "items-center px-1.5"
          )}
        >
          {navItems.map(({ href, label, Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);

            return (
              <SidebarNavItem
                key={href}
                href={href}
                label={label}
                active={active}
                open={open}
                Icon={Icon}
                onNavigate={() => isMobile && setMobileOpen(false)}
              />
            );
          })}
        </nav>

        <div
          className={cn(
            "shrink-0 border-t border-slate-100 dark:border-slate-800",
            open ? "space-y-2 p-2.5" : "flex flex-col items-center gap-2 p-2"
          )}
        >
          <div
            className={cn(
              "flex min-w-0 items-center",
              open &&
                "gap-2.5 rounded-xl bg-slate-50 px-2 py-2 dark:bg-slate-800/60"
            )}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-[#4F46E5] text-[10px] font-semibold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            {open && (
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {society?.adminName}
                </p>
                <p className="truncate text-[10px] text-slate-400">Admin</p>
              </div>
            )}
          </div>

          <button
            type="button"
            title={!open ? "Logout" : undefined}
            onClick={handleLogout}
            className={cn(
              "flex items-center rounded-xl text-[13px] font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40",
              open ? "h-9 w-full gap-3 px-3" : "h-10 w-10 justify-center"
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            {open && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

export function MainShell({ children }: { children: React.ReactNode }) {
  const { railWidth, isMobile } = useSidebar();

  return (
    <div
      className="min-h-screen min-w-0 transition-[padding-left] duration-150 ease-out"
      style={{
        paddingLeft: isMobile ? 0 : railWidth,
        paddingTop: isMobile ? 56 : 0,
      }}
    >
      <main className="mx-auto w-full min-w-0 max-w-[1400px] overflow-x-hidden px-4 pb-28 pt-5 sm:px-6 sm:pt-7 lg:px-10">
        {children}
      </main>
    </div>
  );
}
