"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/shared";
import { Input } from "@/components/ui/shared";
import { Label } from "@/components/ui/shared";

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const authError = searchParams.get("error");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    authError === "CredentialsSignin" ? "Invalid username or password" : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid username or password");
    } else if (result?.url) {
      window.location.href = result.url;
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-2.5rem)] items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="rounded-full bg-primary/10 p-3">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            IdaC Compliance Platform
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !username || !password}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {/* Dev hint */}
        {process.env.NODE_ENV === "development" && (
          <div className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Dev Mode Accounts:</p>
            <ul className="space-y-0.5">
              <li>
                <code>dev</code> / <code>dev</code> — Project Team role
              </li>
              <li>
                <code>admin</code> / <code>admin</code> — Admin role
              </li>
              <li>
                <code>architect</code> / <code>architect</code> — Architect role
              </li>
              <li>
                <code>reviewer</code> / <code>reviewer</code> — ARB Reviewer
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[calc(100vh-2.5rem)] items-center justify-center">Loading…</div>}>
      <SignInForm />
    </Suspense>
  );
}
