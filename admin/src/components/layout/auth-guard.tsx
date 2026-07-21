"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

/** Guards society-admin dashboard routes */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, sessionReady, isSuperAdmin, society } = useAuth();
  const router = useRouter();
  const hasCachedSession = isAuthenticated && !!society;

  useEffect(() => {
    if (!sessionReady || isLoading) return;
    if (isSuperAdmin) {
      router.replace("/super-admin");
      return;
    }
    if (!isAuthenticated || !society) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, sessionReady, isSuperAdmin, society, router]);

  if (!sessionReady && !hasCachedSession) return <LoadingScreen />;
  if (sessionReady && isLoading && !hasCachedSession) return <LoadingScreen />;
  if (isSuperAdmin) return <LoadingScreen />;
  if (!isAuthenticated || !society) {
    if (isLoading || !sessionReady) return <LoadingScreen />;
    return <LoadingScreen />;
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

  if (!sessionReady || isLoading) return <LoadingScreen />;
  if (!isSuperAdmin) return <LoadingScreen />;

  return <>{children}</>;
}
