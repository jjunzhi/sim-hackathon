"use client";

import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/auth/require-auth";
import { VendorTheme } from "@/components/theme-scope";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { signOut, useAuth } from "@/lib/auth/auth-provider";
import { authErrorMessage } from "@/lib/auth/errors";
import { getFirebase } from "@/lib/firebase/client";

export default function AccountPage() {
  return (
    <RequireAuth>
      <Account />
    </RequireAuth>
  );
}

function Account() {
  const auth = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  if (auth.status !== "ready") return null;
  const { user, profile } = auth;

  return (
    <>
      {profile.role === "vendor" && <VendorTheme />}
      <AppHeader />
      <main className="container-page flex flex-col gap-8 py-10">
        <h1 className="text-h1">Account</h1>

        <Card>
          <CardBody className="flex flex-col gap-4">
            <h2 className="text-h3">Your details</h2>
            <dl className="grid gap-3 sm:grid-cols-[12rem_1fr]">
              <dt className="text-small text-muted">Email</dt>
              <dd className="break-all">{user.email}</dd>
              <dt className="text-small text-muted">Account type</dt>
              <dd>
                <Badge tone="neutral" plain>
                  {profile.role === "vendor" ? "Vendor" : "Couple"}
                </Badge>
              </dd>
              <dt className="text-small text-muted">Signed in with</dt>
              <dd>{user.providerData.map((p) => (p.providerId === "google.com" ? "Google" : "Email and password")).join(", ")}</dd>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-4">
            <h2 className="text-h3">Delete your account</h2>
            <p className="max-w-2xl text-muted">
              {profile.role === "vendor"
                ? "This permanently removes your account, your venues, spaces, prices and photos. Couples will no longer see your listings."
                : "This permanently removes your account and everything you've saved."}{" "}
              It can&apos;t be undone.
            </p>
            <Button variant="secondary" className="self-start text-error" icon={<Trash2 aria-hidden className="size-4" />} onClick={() => setDeleteOpen(true)}>
              Delete account
            </Button>
          </CardBody>
        </Card>
      </main>
      <DeleteAccountModal open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}

function DeleteAccountModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const auth = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (auth.status !== "ready") return null;
  const user = auth.user;
  const usesPassword = user.providerData.some((p) => p.providerId === "password");

  async function onDelete(ev?: React.FormEvent) {
    ev?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // Deletion needs a fresh sign-in; the server checks it too.
      if (usesPassword) {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? "", password));
      } else {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      }
      await httpsCallable(getFirebase().functions, "deleteAccount")();
      await signOut("/?accountDeleted=1").catch(() => undefined);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setError(
        code.startsWith("auth/")
          ? authErrorMessage(err)
          : "We couldn't delete everything just now. Nothing has been lost; please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!busy) onOpenChange(o);
      }}
      title="Delete your account?"
      description={usesPassword ? "Enter your password to confirm." : "Confirm with Google to continue."}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)} disabled={busy}>
            Keep my account
          </Button>
          <Button variant="primary" onClick={() => onDelete()} loading={busy}>
            Delete permanently
          </Button>
        </>
      }
    >
      <form onSubmit={onDelete} className="flex flex-col gap-4">
        {usesPassword && (
          <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
        {error && (
          <p role="alert" className="text-small font-medium text-error">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
