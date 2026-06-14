"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendPasswordReset } from "@/lib/actions/auth";
import { AlertTriangle, ArrowLeft, CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const loginHref = redirectTo && /^\/[a-zA-Z0-9\-_/]*$/.test(redirectTo)
    ? `/auth/login?redirect=${encodeURIComponent(redirectTo)}`
    : "/auth/login";
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const email = String(formData.get("email") || "").trim();
      if (!email) {
        setError("Email is required.");
        return;
      }

      const result = await sendPasswordReset(formData);

      if (result.error) setError("We could not send a reset link right now. Please check the email and try again.");
      else setSuccess("Reset link sent. Open it in this same browser, then set your new password.");
    });
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[0.95fr_1.05fr]">
      <div className="signal-shell hidden flex-col justify-between overflow-hidden bg-black p-12 text-white lg:flex dashboard-grid-bg">
        <div className="aura-ring -left-16 -top-16 h-80 w-80 bg-cyan-400/25" />
        <div className="aura-ring -bottom-16 -right-10 h-80 w-80 bg-violet-500/22" style={{ animationDelay: "1.2s" }} />
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />

        <Link href={loginHref} className="relative z-10 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <div className="relative z-10 max-w-lg">
          <BrandLogo variant="full" tone="light" className="mb-6 w-64" imageClassName="aspect-[1100/360]" />
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            SkillTest_AI Recovery
          </div>
          <h1 className="mt-5 max-w-md font-display text-5xl font-semibold leading-tight tracking-tight">Get back in quickly.</h1>
          <p className="mt-5 text-base leading-relaxed text-white/65">
            Enter your work email and SkillTest_AI will route the secure reset link through the verified auth callback before unlocking password update.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {[
            { icon: Mail, title: "1. Enter your email", body: "Use the same email you sign in with." },
            { icon: KeyRound, title: "2. Open the reset link", body: "The link sends you to the password change screen." },
            { icon: ShieldCheck, title: "3. Set a new password", body: "Use at least 8 characters for better security." },
          ].map((item) => (
            <div key={item.title} className="signal-card rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white/10 p-2">
                  <item.icon className="h-4 w-4 text-blue-300" />
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
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-700">
              <Mail className="h-3.5 w-3.5" />
              Password Help
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Reset your password</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              We&apos;ll send a secure reset link to your inbox. If you don&apos;t see it, check spam or promotions.
            </p>
          </div>

          <form onSubmit={handleReset} className="space-y-5">
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
                  <div>
                    <p className="font-medium">Email sent</p>
                    <p className="mt-1">{success}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-zinc-800">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="yourname@company.com"
                  className="h-12 rounded-2xl pl-11"
                />
              </div>
              <p className="text-xs text-zinc-500">Tip: use the same email you used during sign in.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">Fastest Path</p>
                <p className="mt-2 text-sm text-blue-800">Open the reset link on the same browser/device when possible.</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">If Email Delays</p>
                <p className="mt-2 text-sm text-amber-800">Wait a minute, then check spam or try again.</p>
              </div>
            </div>

            <Button type="submit" disabled={isPending} className="h-12 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-700 hover:to-violet-700">
              {isPending ? "Sending reset link..." : "Send reset link"}
            </Button>
          </form>

          <div className="mt-8 flex items-center justify-between gap-4 text-sm">
            <Link href={loginHref} className="font-semibold text-zinc-700 hover:text-black">
              Back to sign in
            </Link>
            <Link href="/auth/sign-up" className="font-semibold text-blue-700 hover:text-blue-800">
              Create new account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
