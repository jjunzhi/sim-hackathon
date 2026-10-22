"use client";

import { GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthLayout, Divider, GoogleIcon } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/auth-provider";
import { authErrorMessage, safeNext } from "@/lib/auth/errors";
import { homeFor } from "@/lib/auth/routes";
import { getFirebase } from "@/lib/firebase/client";

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | "google" | "reset" | null>(null);
  const next = safeNext(params.get("next"));

  // Route once the auth state settles (covers both sign-in methods).
  useEffect(() => {
    if (auth.status === "ready") router.replace(next ?? homeFor(auth.profile.role));
    if (auth.status === "needs-profile") router.replace(`/welcome${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }, [auth, next, router]);

  async function onEmail(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setBusy("email");
    try {
      await signInWithEmailAndPassword(getFirebase().auth, email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(null);
    }
  }

  async function onGoogle() {
    setError(null);
    setBusy("google");
    try {
      await signInWithPopup(getFirebase().auth, new GoogleAuthProvider());
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(null);
    }
  }

  async function onReset() {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter your email address above first.");
      return;
    }
    setBusy("reset");
    try {
      await sendPasswordResetEmail(getFirebase().auth, email.trim());
    } catch {
      // Same message either way, so this can't be used to check who has an account.
    }
    setNotice("If an account uses that email, we've sent a link to reset the password.");
    setBusy(null);
  }

  return (
    <AuthLayout
      title="Welcome back"
      footer={
        <>
          New here?{" "}
          <Link href="/sign-up" className="font-semibold text-accent-text underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <Button variant="secondary" size="lg" onClick={onGoogle} loading={busy === "google"} disabled={busy !== null} icon={<GoogleIcon />}>
        Continue with Google
      </Button>
      <Divider label="or use email" />
      <form onSubmit={onEmail} noValidate className="flex flex-col gap-5">
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && (
          <p role="alert" className="text-small font-medium text-error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-small font-medium text-success">
            {notice}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" loading={busy === "email"} disabled={busy !== null}>
          Sign in
        </Button>
        <Button variant="ghost" onClick={onReset} loading={busy === "reset"} disabled={busy !== null} className="self-center">
          Forgot your password?
        </Button>
      </form>
    </AuthLayout>
  );
}
