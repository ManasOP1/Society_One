"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] dark:bg-slate-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#4F46E5] border-t-transparent" />
    </div>
  );
}

/** Guards society-admin dashboard routes */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, sessionReady, isSuperAdmin, society } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!sessionReady || isLoading) return;
    if (isSuperAdmin) {
      router.replace("/super-admin");
      return;
    }
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, sessionReady, isSuperAdmin, router]);

  if (!sessionReady || isLoading) return <AuthLoadingScreen />;
  if (isSuperAdmin) return <AuthLoadingScreen />;
  if (!isAuthenticated) return <AuthLoadingScreen />;
  if (!society) return <AuthLoadingScreen />;

  return <>{children}</>;
}

/** Guards Super Admin platform console */
export function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, sessionReady, isSuperAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (sessionReady && !isLoading && !isSuperAdmin) {
      router.replace("/super-admin/login");
    }
  }, [isLoading, sessionReady, isSuperAdmin, router]);

  if (!sessionReady || isLoading) return <AuthLoadingScreen />;
  if (!isSuperAdmin) return <AuthLoadingScreen />;

  return <>{children}</>;
}
