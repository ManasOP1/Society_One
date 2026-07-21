"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthLoadingScreen } from "@/components/shared/auth-loading-screen";
import { useAuth } from "@/context/auth-context";

export { AuthLoadingScreen };

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

  if (!sessionReady || isLoading) {
    return (
      <AuthLoadingScreen
        message="Restoring session…"
        submessage="Please wait a moment"
      />
    );
  }
  if (isSuperAdmin) return <AuthLoadingScreen message="Redirecting…" />;
  if (!isAuthenticated) return <AuthLoadingScreen message="Redirecting to login…" />;
  if (!society) {
    return (
      <AuthLoadingScreen
        message="Loading your society…"
        submessage="Fetching members and settings"
      />
    );
  }

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

  if (!sessionReady || isLoading) {
    return <AuthLoadingScreen message="Loading console…" />;
  }
  if (!isSuperAdmin) return <AuthLoadingScreen message="Redirecting…" />;

  return <>{children}</>;
}
