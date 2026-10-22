"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Friendly page for unexpected errors; the details go to the browser console and Vercel's logs, not to the person. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Unhandled error", error.digest ?? "", error);
  }, [error]);
  return (
    <main className="container-page flex min-h-dvh flex-col items-start justify-center gap-5 py-16">
      <Link href="/" className="font-display text-h3 text-ink">
        WeddingVista
      </Link>
      <h1 className="text-h1">Something went wrong</h1>
      <p className="max-w-xl text-muted">Nothing you saved has been lost. Please try again; if it keeps happening, come back in a few minutes.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center rounded-full bg-accent px-6 font-semibold text-on-accent hover:bg-accent-hover">
          Try again
        </button>
        <Link href="/" className="inline-flex min-h-11 items-center px-3 font-semibold text-accent-text underline underline-offset-4">
          Home
        </Link>
      </div>
    </main>
  );
}
