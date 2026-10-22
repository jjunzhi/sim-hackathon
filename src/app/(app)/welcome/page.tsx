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

/** For people who signed in (e.g. with Google) but haven't chosen a role or given consent. */
export default function WelcomePage() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}

function Welcome() {
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
    if (!role) e.role = "Choose how you'll use WeddingVista.";
    if (!consent) e.consent = "Please agree before continuing.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await createProfile(user.uid, role!);
    } catch {
      setErrors({ form: "We couldn't save that. Please try again." });
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="One last step" intro={`Signed in as ${user.email ?? "your account"}.`}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <RolePicker value={role} onChange={setRole} error={errors.role} />
        <ConsentField checked={consent} onChange={setConsent} error={errors.consent} />
        {errors.form && (
          <p role="alert" className="text-small font-medium text-error">
            {errors.form}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" loading={busy}>
          Continue
        </Button>
        <Button variant="ghost" onClick={() => signOut()} className="self-center">
          Use a different account
        </Button>
      </form>
    </AuthLayout>
  );
}
