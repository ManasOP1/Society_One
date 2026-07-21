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
  const { isAuthenticated, isLoading, isSuperAdmin, society } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (isSuperAdmin) {
      router.replace("/super-admin");
      return;
    }
    if (!isAuthenticated || !society) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, isSuperAdmin, society, router]);

  if (isLoading) return <LoadingScreen />;
  if (isSuperAdmin || !isAuthenticated || !society) return null;

  return <>{children}</>;
}

/** Guards Super Admin platform console */
export function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isSuperAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isSuperAdmin) {
      router.replace("/super-admin/login");
    }
  }, [isLoading, isSuperAdmin, router]);

  if (isLoading) return <LoadingScreen />;
  if (!isSuperAdmin) return null;

  return <>{children}</>;
}
