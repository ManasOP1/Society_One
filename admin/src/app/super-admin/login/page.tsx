"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { SUPER_ADMIN } from "@/services/society.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SuperAdminLoginPage() {
  const { loginSuperAdmin, isSuperAdmin, isLoading, sessionReady } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setEmail(SUPER_ADMIN.email);
  }, []);

  useEffect(() => {
    if (!mounted || !sessionReady || isLoading) return;
    if (isSuperAdmin) router.replace("/super-admin");
  }, [mounted, isLoading, sessionReady, isSuperAdmin, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = await loginSuperAdmin(email, password);
    if (err) {
      setError(err);
      return;
    }
    router.replace("/super-admin");
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">SocietyOne</h1>
          <p className="mt-1 text-sm text-slate-500">Super Admin login</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Demo: {SUPER_ADMIN.email} / {SUPER_ADMIN.password}
        </p>
        <Link
          href="/login"
          className="mt-3 block text-center text-sm text-slate-600 hover:text-slate-900"
        >
          ← Society admin login
        </Link>
      </div>
    </div>
  );
}
