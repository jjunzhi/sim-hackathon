"use client";

import { CircleAlert } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth/auth-provider";
import { SkeletonList } from "@/components/ui/skeleton";

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
  return (
    <main className="container-page flex min-h-dvh items-center py-16">
      <div role="alert" className="flex max-w-xl flex-col gap-4 rounded-card border border-error bg-surface p-6 shadow-soft">
        <div className="flex items-center gap-3 text-error">
          <CircleAlert aria-hidden className="size-6" />
          <h1 className="text-h3 text-ink">Firebase is not configured</h1>
        </div>
        <p className="text-muted">
          Sign-in and saving need Firebase settings in <code className="rounded bg-subtle px-1.5">.env.local</code>. Nothing has been
          saved and the app will not work without them.
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
        <p className="text-small text-muted">See README, section &quot;Firebase setup&quot;, then restart the dev server.</p>
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

export function LoadingScreen({ label = "Loading your account" }: { label?: string }) {
  return (
    <main className="container-page py-16">
      <SkeletonList rows={3} label={label} />
    </main>
  );
}
