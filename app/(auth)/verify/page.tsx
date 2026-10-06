"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function VerifyPageContent() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();

  const email = params.get("email") ?? "";
  const company = params.get("company") ?? "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const cleaned = code.replace(/\s/g, "");
    return email && cleaned.length >= 6;
  }, [code, email]);

  async function handleVerify() {
    setLoading(true);
    setMsg(null);

    const token = code.replace(/\s/g, "");

    // Verify the OTP code sent to email
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      setLoading(false);
      setMsg(error.message);
      return;
    }

    // At this point we have a session (data.session) and a user (data.user)
    // Create contractor profile row (company name)
    const userId = data.user?.id;

    if (userId) {
      const { error: profileError } = await supabase
        .from("contractor_profiles")
        .upsert(
          {
            user_id: userId,
            company_name: company || null,
          },
          { onConflict: "user_id" }
        );

      if (profileError) {
        // If this fails, it's usually RLS not set or table missing.
        setLoading(false);
        setMsg(profileError.message);
        return;
      }
    }

    // Sign out so they land on login and authenticate normally
    await supabase.auth.signOut();

    setLoading(false);
    await fetch("/api/auth/verified", { method: "POST" });
    router.push("/login");
  }

  async function resendCode() {
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    setLoading(false);
    setMsg(error ? error.message : "New code sent to your email.");
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md gap-6 p-6 sm:p-8">
        <div className="text-sm font-semibold tracking-tight text-primary">JobSyte<span className="ml-2 font-normal text-muted-foreground">/ Contractor workspace</span></div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Verify your email</h1>
          <div className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to{" "}
            <span className="font-medium text-foreground">{email}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verify-code">Verification code</Label>
            <Input id="verify-code" value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
            />
          </div>

          <Button className="w-full" disabled={loading || !canSubmit} onClick={handleVerify}>
            {loading ? "Verifying..." : "Verify"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading || !email}
            onClick={resendCode}
          >
            Resend code
          </Button>

          <div className="text-sm text-muted-foreground">
            Back to{" "}
            <a className="underline" href="/login">
              login
            </a>
          </div>

          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        </div>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center bg-background px-4 py-10">
          <Card className="w-full max-w-md gap-6 p-6 sm:p-8">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </Card>
        </div>
      }
    >
      <VerifyPageContent />
    </Suspense>
  );
}
