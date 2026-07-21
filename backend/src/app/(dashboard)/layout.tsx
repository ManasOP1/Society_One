"use client";

import { AuthGuard } from "@/components/layout/auth-guard";
import { Sidebar, MainShell } from "@/components/layout/sidebar";
import { FloatingActions } from "@/components/layout/floating-actions";
import { SidebarProvider } from "@/context/sidebar-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <div className="min-h-screen min-w-0 overflow-x-hidden bg-background">
          <Sidebar />
          <MainShell>{children}</MainShell>
          <FloatingActions />
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
