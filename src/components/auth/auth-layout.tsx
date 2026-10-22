import Link from "next/link";

export function AuthLayout({ title, intro, children, footer }: { title: string; intro?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="container-page flex min-h-dvh flex-col py-8 sm:py-14">
      <Link href="/" className="mb-8 w-fit font-display text-h3 text-ink">
        WeddingVista
      </Link>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1">{title}</h1>
          {intro && <p className="text-muted">{intro}</p>}
        </div>
        <div className="flex flex-col gap-6 rounded-card border border-line bg-surface p-5 shadow-soft sm:p-8">{children}</div>
        {footer && <div className="text-center text-small text-muted">{footer}</div>}
      </div>
    </main>
  );
}

export function GoogleIcon() {
  // Google "G" mark, shown at icon size next to the provider name.
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}

export function Divider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-small text-muted" role="separator">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
