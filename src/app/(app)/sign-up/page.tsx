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
import { stashInvite } from "@/lib/data/billing";
import { createProfile, type Role } from "@/lib/data/users";
import { getFirebase } from "@/lib/firebase/client";
import { useT } from "@/lib/i18n/provider";

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUp />
    </Suspense>
  );
}

function SignUp() {
  const t = useT();
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

  // A pilot invite link (?role=vendor&invite=...) is redeemed once the vendor area opens.
  const invite = params.get("invite");
  useEffect(() => {
    if (invite) stashInvite(invite);
  }, [invite]);

  // Already signed in with a profile: go home.
  useEffect(() => {
    if (auth.status === "ready" && !busy) router.replace(safeNext(params.get("next")) ?? homeFor(auth.profile.role));
  }, [auth, busy, params, router]);

  function checkChoices(): boolean {
    const e: Record<string, string> = {};
    if (!role) e.role = t("auth.signUp.chooseRole");
    if (!consent) e.consent = t("auth.signUp.agreeFirst");
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
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = t("auth.error.invalidEmail");
    if (password.length < 8) e.password = t("auth.signUp.passwordShort");
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
      setErrors({ form: authErrorMessage(err, t) ?? "" });
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
      const msg = authErrorMessage(err, t);
      setErrors(msg ? { form: msg } : {});
      setBusy(null);
    }
  }

  return (
    <AuthLayout
      title={t("auth.signUp.title")}
      intro={t("auth.signUp.intro")}
      footer={
        <>
          {t("auth.signUp.haveAccount")}{" "}
          <Link href="/sign-in" className="font-semibold text-accent-text underline underline-offset-4">
            {t("nav.signIn")}
          </Link>
        </>
      }
    >
      <form onSubmit={onEmail} noValidate className="flex flex-col gap-6">
        <RolePicker value={role} onChange={setRole} error={errors.role} />
        <ConsentField checked={consent} onChange={setConsent} error={errors.consent} />

        <Button variant="secondary" size="lg" onClick={onGoogle} loading={busy === "google"} disabled={busy !== null} icon={<GoogleIcon />}>
          {t("auth.continueWithGoogle")}
        </Button>
        <Divider label={t("auth.orUseEmail")} />
        <Input label={t("auth.email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Input
          label={t("auth.password")}
          type="password"
          autoComplete="new-password"
          hint={t("auth.signUp.passwordHint")}
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
          {t("auth.signUp.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
