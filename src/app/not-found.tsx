import Link from "next/link";

/** Branded 404 for any unknown address. */
export default function NotFound() {
  return (
    <main className="container-page flex min-h-dvh flex-col items-start justify-center gap-5 py-16">
      <Link href="/" className="font-display text-h3 text-ink">
        WeddingVista
      </Link>
      <h1 className="text-h1">We couldn&apos;t find that page</h1>
      <p className="max-w-xl text-muted">The link may be mistyped, or the page may have moved. If someone shared it with you, ask them to send it again.</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/venues" className="inline-flex min-h-11 items-center rounded-full bg-accent px-6 font-semibold text-on-accent hover:bg-accent-hover">
          Find a venue
        </Link>
        <Link href="/" className="inline-flex min-h-11 items-center px-3 font-semibold text-accent-text underline underline-offset-4">
          Home
        </Link>
      </div>
    </main>
  );
}
