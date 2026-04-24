"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, CheckCircle2, KeyRound, ShieldCheck, Sparkles } from "lucide-react";

function UpdatePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCheckingLink, setIsCheckingLink] = useState(true);
  const [isRecoveryReady, setIsRecoveryReady] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let mounted = true;

    async function prepareRecoverySession() {
      const supabase = createClient();
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      try {
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          if (mounted) setIsRecoveryReady(true);
          window.history.replaceState(null, "", "/auth/update-password");
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (mounted) setIsRecoveryReady(true);
          router.replace("/auth/update-password");
        } else if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (error) throw error;
          if (mounted) setIsRecoveryReady(true);
          router.replace("/auth/update-password");
        } else {
          const { data } = await supabase.auth.getSession();
          if (mounted) setIsRecoveryReady(Boolean(data.session));
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || "This password reset link is invalid or expired.");
          setIsRecoveryReady(false);
        }
      } finally {
        if (mounted) setIsCheckingLink(false);
      }
    }

    prepareRecoverySession();
    return () => {
      mounted = false;
    };
  }, [router, searchParams]);

  async function handleUpdate(formData: FormData) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const password = formData.get("password") as string;
      const confirmPassword = formData.get("confirm_password") as string;

      if (!password) {
        setError("Password is required.");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }

      setSuccess("Password updated successfully. Redirecting to sign in...");
      setTimeout(() => router.push("/auth/login"), 1800);
    });
  }

  return (
    <div className="min-h-screen grid bg-background lg:grid-cols-[1fr_1fr]">
      <div className="hidden lg:flex flex-col justify-between bg-black p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 h-72 w-72 -translate-x-1/3 -translate-y-1/3 rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 translate-x-1/3 translate-y-1/3 rounded-full bg-blue-500/20 blur-3xl" />

        <Link href="/auth/login" className="relative z-10 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <div className="relative z-10 max-w-lg">
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Secure Update</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight">Set your new password.</h1>
          <p className="mt-5 text-base leading-relaxed text-white/65">
            We verify your recovery link first, then unlock password update for your account.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {[
            { icon: Sparkles, title: "Recovery link check", body: "We verify your reset token automatically." },
            { icon: KeyRound, title: "Password update", body: "Choose a strong password with at least 8 characters." },
            { icon: ShieldCheck, title: "Safe redirect", body: "After success, you return to sign in with the new password." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white/10 p-2">
                  <item.icon className="h-4 w-4 text-emerald-300" />
                </div>
                <div>
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-white/55">{item.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-lg rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-xl">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Recovery Protected
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Set a new password</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              {isCheckingLink ? "Validating your recovery link..." : "Choose a password you can remember and use it to sign in again."}
            </p>
          </div>

          <form action={handleUpdate} className="space-y-5">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4" />
                  <div>{success}</div>
                </div>
              </div>
            )}

            {!isRecoveryReady && !isCheckingLink && !success && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                This link may be expired. Request a fresh password reset email to continue.
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-zinc-800">New password</label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Use at least 8 characters"
                disabled={isCheckingLink || !isRecoveryReady}
                className="h-12 rounded-2xl"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm_password" className="block text-sm font-semibold text-zinc-800">Confirm password</label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                minLength={8}
                placeholder="Repeat the new password"
                disabled={isCheckingLink || !isRecoveryReady}
                className="h-12 rounded-2xl"
              />
              <p className="text-xs text-zinc-500">Tip: use a memorable passphrase if your company policy allows it.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">Helpful</p>
                <p className="mt-2 text-sm text-blue-800">Avoid reusing old passwords.</p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-700">After update</p>
                <p className="mt-2 text-sm text-violet-800">You will return to the sign in page automatically.</p>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isPending || isCheckingLink || !isRecoveryReady}
              className="h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-blue-600 text-white hover:from-emerald-700 hover:to-blue-700"
            >
              {isPending ? "Updating password..." : "Update password"}
            </Button>
          </form>

          <div className="mt-8 flex items-center justify-between gap-4 text-sm">
            <Link href="/auth/reset-password" className="font-semibold text-blue-700 hover:text-blue-800">
              Request another reset email
            </Link>
            <Link href="/auth/login" className="font-semibold text-zinc-700 hover:text-black">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense>
      <UpdatePasswordForm />
    </Suspense>
  );
}
