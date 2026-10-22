"use client";

import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthLayout, Divider, GoogleIcon } from "@/components/auth/auth-layout";
import { ConsentField, RolePicker } from "@/components/auth/role-and-consent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/auth-provider";
import { authErrorMessage, safeNext } from "@/lib/auth/errors";
import { homeFor } from "@/lib/auth/routes";
import { createProfile, type Role } from "@/lib/data/users";
import { getFirebase } from "@/lib/firebase/client";

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUp />
    </Suspense>
  );
}

function SignUp() {
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAuth();
  const presetRole = params.get("role");
  const [role, setRole] = useState<Role | null>(presetRole === "vendor" || presetRole === "couple" ? presetRole : null);
  const [consent, setConsent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"email" | "google" | null>(null);

  // Already signed in with a profile: go home.
  useEffect(() => {
    if (auth.status === "ready" && !busy) router.replace(safeNext(params.get("next")) ?? homeFor(auth.profile.role));
  }, [auth, busy, params, router]);

  function checkChoices(): boolean {
    const e: Record<string, string> = {};
    if (!role) e.role = "Choose how you'll use WeddingVista.";
    if (!consent) e.consent = "Please agree before creating your account.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function done(r: Role) {
    router.replace(safeNext(params.get("next")) ?? homeFor(r));
  }

  async function onEmail(ev: React.FormEvent) {
    ev.preventDefault();
    const ok = checkChoices();
    const e: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = "Enter an email address like name@example.com.";
    if (password.length < 8) e.password = "Use at least 8 characters.";
    if (!ok || Object.keys(e).length) {
      setErrors((prev) => ({ ...prev, ...e }));
      return;
    }
    setBusy("email");
    try {
      const cred = await createUserWithEmailAndPassword(getFirebase().auth, email.trim(), password);
      await createProfile(cred.user.uid, role!);
      done(role!);
    } catch (err) {
      setErrors({ form: authErrorMessage(err) ?? "" });
      setBusy(null);
    }
  }

  async function onGoogle() {
    if (!checkChoices()) return;
    setBusy("google");
    try {
      const { auth: fbAuth, db } = getFirebase();
      const cred = await signInWithPopup(fbAuth, new GoogleAuthProvider());
      const existing = await getDoc(doc(db, "users", cred.user.uid));
      if (existing.exists()) {
        // Existing account: keep its original role.
        done(existing.get("role") as Role);
        return;
      }
      await createProfile(cred.user.uid, role!);
      done(role!);
    } catch (err) {
      const msg = authErrorMessage(err);
      setErrors(msg ? { form: msg } : {});
      setBusy(null);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      intro="Start planning, or list your venue."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-accent-text underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onEmail} noValidate className="flex flex-col gap-6">
        <RolePicker value={role} onChange={setRole} error={errors.role} />
        <ConsentField checked={consent} onChange={setConsent} error={errors.consent} />

        <Button variant="secondary" size="lg" onClick={onGoogle} loading={busy === "google"} disabled={busy !== null} icon={<GoogleIcon />}>
          Continue with Google
        </Button>
        <Divider label="or use email" />
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        {errors.form && (
          <p role="alert" className="text-small font-medium text-error">
            {errors.form}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" loading={busy === "email"} disabled={busy !== null}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
