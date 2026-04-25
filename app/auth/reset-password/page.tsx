"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";

export default function ResetPasswordPage() {
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

      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) setError("We could not send a reset link right now. Please check the email and try again.");
      else setSuccess("Reset link sent. Open it in this same browser, then set your new password.");
    });
  }

  return (
    <div className="min-h-screen grid bg-background lg:grid-cols-[1fr_1fr]">
      <div className="hidden lg:flex flex-col justify-between bg-black p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 h-72 w-72 -translate-x-1/3 -translate-y-1/3 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 translate-x-1/3 translate-y-1/3 rounded-full bg-violet-500/20 blur-3xl" />

        <Link href="/auth/login" className="relative z-10 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <div className="relative z-10 max-w-lg">
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Account Recovery</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight">Get back in quickly.</h1>
          <p className="mt-5 text-base leading-relaxed text-white/65">
            Enter your work email and we&apos;ll send you a secure reset link. The link opens directly in the password update screen.
          </p>
        </div>

        <div className="relative z-10 space-y-4">
          {[
            { icon: Mail, title: "1. Enter your email", body: "Use the same email you sign in with." },
            { icon: KeyRound, title: "2. Open the reset link", body: "The link sends you to the password change screen." },
            { icon: ShieldCheck, title: "3. Set a new password", body: "Use at least 8 characters for better security." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
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

      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-lg rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-xl">
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
                {error}
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
            <Link href="/auth/login" className="font-semibold text-zinc-700 hover:text-black">
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
