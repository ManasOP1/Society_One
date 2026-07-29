"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
import { LayersIcon } from "@animateicons/react/lucide";
import { AuthLoadingScreen } from "@/components/shared/auth-loading-screen";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SuperAdminLoginPage() {
  const { loginSuperAdmin, isSuperAdmin, isLoading, sessionReady } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sessionKnown = sessionReady && !isLoading;

  useEffect(() => {
    if (!sessionKnown || !isSuperAdmin) return;
    router.replace("/super-admin");
  }, [sessionKnown, isSuperAdmin, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const err = await loginSuperAdmin(email, password);
    if (err) {
      setSubmitting(false);
      setError(err);
      return;
    }
    router.replace("/super-admin");
  };

  if (!sessionKnown) {
    return <AuthLoadingScreen message="Checking session…" />;
  }

  if (submitting) {
    return (
      <AuthLoadingScreen
        message="Signing you in…"
        submessage="Verifying credentials"
      />
    );
  }

  if (isSuperAdmin) {
    return <AuthLoadingScreen message="Opening console…" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-4 dark:bg-slate-950">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-2">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-[#0F172A] to-[#1E293B] p-8 text-white lg:flex">
          <div className="flex items-center gap-2">
            <LayersIcon size={28} color="#fff" />
            <span className="text-xl font-bold">SocietyOne</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold leading-snug">
              Platform Administration
            </h2>
            <p className="mt-3 text-sm text-slate-300">
              Manage all societies, users, and platform-wide settings from a
              single console.
            </p>
          </div>
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} SocietyOne
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <LayersIcon size={24} color="#4F46E5" />
            <span className="text-lg font-bold">SocietyOne</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Super Admin Login
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to the platform management console
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-10"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-10"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#4F46E5] hover:underline"
            >
              <ShieldCheck className="h-4 w-4" />
              Society Admin Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
