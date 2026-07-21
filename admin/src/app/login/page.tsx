"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, Shield } from "lucide-react";
import { LayersIcon } from "@animateicons/react/lucide";
import { AuthLoadingScreen } from "@/components/layout/auth-guard";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const { login, isAuthenticated, isSuperAdmin, isLoading, sessionReady, society } =
    useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sessionKnown = sessionReady && !isLoading;

  useEffect(() => {
    if (!sessionKnown) return;
    if (isSuperAdmin) router.replace("/super-admin");
    else if (isAuthenticated && society) router.replace("/");
  }, [sessionKnown, isAuthenticated, isSuperAdmin, society, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const err = await login("", email, password);
    if (err) {
      setSubmitting(false);
      setError(err);
      return;
    }
    router.replace("/");
  };

  if (!sessionKnown || submitting || isAuthenticated) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-4 dark:bg-slate-950">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-2">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-[#4F46E5] to-[#312E81] p-8 text-white lg:flex">
          <div className="flex items-center gap-2">
            <LayersIcon size={28} color="#fff" />
            <span className="text-xl font-bold">SocietyOne</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold leading-snug">
              Society ops console — one building at a time.
            </h2>
            <p className="mt-3 text-sm text-indigo-100">
              This admin panel is the society backend. The resident experience
              will live in a separate app that talks to the same APIs.
            </p>
          </div>
          <p className="text-xs text-indigo-200">
            Seeded account: <strong>admin@greenvalley.in</strong> / admin123
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <LayersIcon size={24} color="#4F46E5" />
            <span className="text-lg font-bold">SocietyOne</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Society Admin Login
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in with your society admin account
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Admin email
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
              {submitting ? "Signing in…" : "Sign in to society"}
            </Button>

            <Link
              href="/reset-password"
              className="block text-center text-sm font-medium text-[#4F46E5] hover:underline"
            >
              Forgot password?
            </Link>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Link
              href="/super-admin/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#4F46E5] hover:underline"
            >
              <Shield className="h-4 w-4" />
              Super Admin — manage all societies
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
