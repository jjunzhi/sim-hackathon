"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoadingScreen } from "@/components/auth/auth-shell";
import { ConsentField, RolePicker } from "@/components/auth/role-and-consent";
import { Button } from "@/components/ui/button";
import { signOut, useAuth } from "@/lib/auth/auth-provider";
import { safeNext } from "@/lib/auth/errors";
import { homeFor } from "@/lib/auth/routes";
import { createProfile, type Role } from "@/lib/data/users";
import { useT } from "@/lib/i18n/provider";

/** For people who signed in (e.g. with Google) but haven't chosen a role or given consent. */
export default function WelcomePage() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}

function Welcome() {
  const t = useT();
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<Role | null>(null);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (auth.status === "signed-out") router.replace("/sign-in");
    if (auth.status === "ready") router.replace(safeNext(params.get("next")) ?? homeFor(auth.profile.role));
  }, [auth, params, router]);

  if (auth.status !== "needs-profile") return <LoadingScreen />;
  const user = auth.user;

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!role) e.role = t("auth.signUp.chooseRole");
    if (!consent) e.consent = t("auth.welcome.agreeFirst");
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await createProfile(user.uid, role!);
    } catch {
      setErrors({ form: t("error.save") });
      setBusy(false);
    }
  }

  return (
    <AuthLayout title={t("auth.welcome.title")} intro={t("auth.welcome.signedInAs", { email: user.email ?? t("auth.welcome.yourAccount") })}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <RolePicker value={role} onChange={setRole} error={errors.role} />
        <ConsentField checked={consent} onChange={setConsent} error={errors.consent} />
        {errors.form && (
          <p role="alert" className="text-small font-medium text-error">
            {errors.form}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" loading={busy}>
          {t("auth.welcome.continue")}
        </Button>
        <Button variant="ghost" onClick={() => signOut()} className="self-center">
          {t("auth.welcome.differentAccount")}
        </Button>
      </form>
    </AuthLayout>
  );
}
