"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendPasswordReset } from "@/lib/actions/auth";

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleReset(formData: FormData) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await sendPasswordReset(formData);
      if (result?.error) setError(result.error);
      else setSuccess("If your email exists, a reset link has been sent.");
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-2">Reset your password</h1>
        <p className="text-muted-foreground mb-6 text-sm">Enter your email to receive a password reset link.</p>
        <form action={handleReset} className="space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}
          {success && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded">{success}</div>}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold mb-1">Email Address</label>
            <Input id="email" name="email" type="email" required placeholder="yourname@company.com" />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">Send reset link</Button>
        </form>
        <div className="mt-6 text-center">
          <Link href="/auth/login" className="text-primary font-semibold hover:underline underline-offset-4 text-sm">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
