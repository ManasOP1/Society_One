"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { authApi, apiErrorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(params.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"request" | "reset">(
    params.get("token") ? "reset" : "request"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setMessage(
        "If an account exists for this email, reset instructions have been sent. In development, check the API server logs for the reset link."
      );
      setStep("reset");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authApi.resetPassword(token.trim(), password);
      router.replace("/login");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {step === "request" ? "Forgot password" : "Reset password"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {step === "request"
            ? "Enter your admin email to receive a reset link."
            : "Paste the token from your email and set a new password."}
        </p>

        {step === "request" ? (
          <form onSubmit={onRequest} className="mt-6 space-y-4">
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
                  required
                />
              </div>
            </div>
            {message && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {message}
              </p>
            )}
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        ) : (
          <form onSubmit={onReset} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Reset token
              </label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste token from email"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                New password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-10"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
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
              {submitting ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-6 block text-center text-sm font-medium text-[#4F46E5] hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
