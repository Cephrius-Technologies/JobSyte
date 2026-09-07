"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const passwordError = useMemo(() => {
    if (!password || !confirm) return null;
    return password === confirm ? null : "Passwords do not match.";
  }, [password, confirm]);

  async function handleSignup() {
    setLoading(true);
    setMsg(null);

    if (password !== confirm) {
      setLoading(false);
      setMsg("Passwords do not match.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // This is where Supabase will redirect AFTER clicking the email verification link
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { company_name: companyName },
      },
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Check your email to verify your account, then come back to sign in.");
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md gap-6 p-6 sm:p-8">
        <div className="text-sm font-semibold tracking-tight text-primary">JobSyte<span className="ml-2 font-normal text-muted-foreground">/ Contractor workspace</span></div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <div className="text-sm text-muted-foreground">
            We’ll email you a verification link.
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signup-companyName">Company Name</Label>
            <Input id="signup-companyName" value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Cephrius LLC"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input id="signup-email" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <Input id="signup-password" autoComplete="new-password" type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="•••••••••••••"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-confirm">Confirm Password</Label>
            <Input id="signup-confirm" type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="•••••••••••••"
            />
            {passwordError && (
              <p className="text-xs text-destructive">{passwordError}</p>
            )}
          </div>

          <Button
            className="w-full"
            disabled={loading || !companyName || !email || !password || !confirm || !!passwordError}
            onClick={handleSignup}
          >
            {loading ? "Creating..." : "Create account"}
          </Button>

          <div className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <a className="underline" href="/login">
              Sign in
            </a>
          </div>

          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        </div>
      </Card>
    </div>
  );
}
