"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleUpdate(formData: FormData) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const password = formData.get("password") as string;
      if (!password) {
        setError("Password is required");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setError(error.message);
      else {
        setSuccess("Password updated! Redirecting to login...");
        setTimeout(() => router.push("/auth/login"), 2000);
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-2">Set a new password</h1>
        <p className="text-muted-foreground mb-6 text-sm">Enter your new password below.</p>
        <form action={handleUpdate} className="space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}
          {success && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded">{success}</div>}
          <div>
            <label htmlFor="password" className="block text-sm font-semibold mb-1">New Password</label>
            <Input id="password" name="password" type="password" required placeholder="Enter new password" />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">Update password</Button>
        </form>
      </div>
    </div>
  );
}
