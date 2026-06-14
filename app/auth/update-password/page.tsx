"use client";

import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";

function recoveryErrorMessage(message?: string) {
  if (!message) return "This password reset link is invalid or expired.";
  if (/code verifier|pkce|expired|invalid|otp|token/i.test(message)) {
    return "This password reset link is invalid or expired. Please request a fresh reset email and open the newest link.";
  }
  return "We could not verify this password reset link. Please request a fresh email and try again.";
}

function UpdatePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCheckingLink, setIsCheckingLink] = useState(true);
  const [isRecoveryReady, setIsRecoveryReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const recoveryPreparedRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let mounted = true;

    async function prepareRecoverySession() {
      if (recoveryPreparedRef.current) return;
      recoveryPreparedRef.current = true;
      const supabase = createClient();
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const queryError = searchParams.get("error_description") || searchParams.get("error");
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const hashError = hash.get("error_description") || hash.get("error");

      try {
        if (queryError) throw new Error(queryError);
        if (hashError) throw new Error(hashError);
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
        } else if (tokenHash && (type === "recovery" || type === "invite")) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
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
          setError(recoveryErrorMessage(err?.message));
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

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const roleQuery = user
        ? await supabase.from("profiles").select("role").eq("id", user.id).single()
        : { data: null as { role?: string } | null };

      const nextPath =
        roleQuery.data?.role === "manager" || roleQuery.data?.role === "admin"
          ? "/manager"
          : "/employee";
      const fallbackLogin = `/auth/login?reset=success&redirect=${encodeURIComponent(nextPath)}`;

      if (user?.email) {
        await supabase.auth.signOut({ scope: "local" });
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password,
        });

        if (signInError) {
          setSuccess("Password updated. Please sign in with your new password.");
          setTimeout(() => router.push(fallbackLogin), 1800);
          return;
        }
      }

      setSuccess("Password updated successfully. Signing you in...");
      setTimeout(() => router.push(nextPath), 1200);
    });
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[0.95fr_1.05fr]">
      <div className="signal-shell hidden flex-col justify-between overflow-hidden bg-black p-12 text-white lg:flex dashboard-grid-bg">
        <div className="aura-ring -left-16 -top-16 h-80 w-80 bg-emerald-400/24" />
        <div className="aura-ring -bottom-16 -right-10 h-80 w-80 bg-blue-500/22" style={{ animationDelay: "1.2s" }} />
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent" />

        <Link href="/auth/login" className="relative z-10 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <div className="relative z-10 max-w-lg">
          <BrandLogo variant="full" tone="light" className="mb-6 w-64" imageClassName="aspect-[1100/360]" />
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            Reset Protected
          </div>
          <h1 className="mt-5 max-w-md font-display text-5xl font-semibold leading-tight tracking-tight">Verify and reset your password.</h1>
          <p className="mt-5 text-base leading-relaxed text-white/65">
            We verify your secure email link first, then unlock password reset for your account.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {[
            { icon: Sparkles, title: "Email link check", body: "We verify your reset token automatically." },
            { icon: KeyRound, title: "Password update", body: "Choose a strong password with at least 8 characters." },
            { icon: ShieldCheck, title: "Safe redirect", body: "After success, you return to sign in with the new password." },
          ].map((item) => (
            <div key={item.title} className="signal-card rounded-2xl border border-white/10 bg-white/5 p-4">
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

      <div className="relative flex items-center justify-center overflow-hidden p-6 md:p-10">
        <div className="absolute inset-0 mesh-bg opacity-80" />
        <div className="signal-shell relative w-full max-w-lg rounded-[2rem] border border-zinc-200 bg-white/92 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Reset Protected
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Set a new password</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              {isCheckingLink ? "Validating your secure email link..." : "Choose a password you can remember and use it to sign in again."}
            </p>
          </div>

          <form action={handleUpdate} className="space-y-5">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
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
                Request a fresh password reset email and open the newest link to continue.
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-zinc-800">New password</label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder="Use at least 8 characters"
                  disabled={isCheckingLink || !isRecoveryReady}
                  className="h-12 rounded-2xl pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={isCheckingLink || !isRecoveryReady}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 disabled:opacity-40"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm_password" className="block text-sm font-semibold text-zinc-800">Confirm password</label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={8}
                  placeholder="Repeat the new password"
                  disabled={isCheckingLink || !isRecoveryReady}
                  className="h-12 rounded-2xl pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  disabled={isCheckingLink || !isRecoveryReady}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 disabled:opacity-40"
                  aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
