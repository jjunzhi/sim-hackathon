"use client";

import { CircleAlert } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth/auth-provider";
import { SkeletonList } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n/provider";

/** Client-only wrapper for every signed-in screen. */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ConfigGate>{children}</ConfigGate>
    </AuthProvider>
  );
}

function ConfigGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (auth.status === "config-error") return <ConfigErrorScreen missing={auth.error.missing} detail={auth.error.message} />;
  if (auth.status === "error") return <ProblemScreen message={auth.message} />;
  return <>{children}</>;
}

export function ConfigErrorScreen({ missing, detail }: { missing: string[]; detail: string }) {
  const t = useT();
  // The file name is rendered as <code>, so the sentence is split around its placeholder.
  const [beforeFile, afterFile] = t("ui.authShell.needsSettings").split("{file}");
  return (
    <main className="container-page flex min-h-dvh items-center py-16">
      <div role="alert" className="flex max-w-xl flex-col gap-4 rounded-card border border-error bg-surface p-6 shadow-soft">
        <div className="flex items-center gap-3 text-error">
          <CircleAlert aria-hidden className="size-6" />
          <h1 className="text-h3 text-ink">{t("ui.authShell.notConfigured")}</h1>
        </div>
        <p className="text-muted">
          {beforeFile}
          <code className="rounded bg-subtle px-1.5">.env.local</code>
          {afterFile}
        </p>
        {missing.length > 0 ? (
          <ul className="list-disc pl-5 text-small">
            {missing.map((m) => (
              <li key={m}>
                <code>{m}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small">{detail}</p>
        )}
        <p className="text-small text-muted">{t("ui.authShell.seeReadme")}</p>
      </div>
    </main>
  );
}

function ProblemScreen({ message }: { message: string }) {
  return (
    <main className="container-page flex min-h-dvh items-center py-16">
      <p role="alert" className="rounded-card border border-error bg-surface p-6 text-ink">
        {message}
      </p>
    </main>
  );
}

export function LoadingScreen({ label }: { label?: string }) {
  const t = useT();
  return (
    <main className="container-page py-16">
      <SkeletonList rows={3} label={label ?? t("ui.authShell.loadingAccount")} />
    </main>
  );
}
