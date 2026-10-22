import Link from "next/link";

export default async function Home({ searchParams }: { searchParams: Promise<{ accountDeleted?: string }> }) {
  const { accountDeleted } = await searchParams;
  return (
    <main className="container-page flex min-h-dvh flex-col justify-center gap-6 py-16">
      {accountDeleted === "1" && (
        <p role="status" className="w-fit rounded-xl border border-success bg-surface px-4 py-3 text-small font-medium text-success">
          Your account and data have been deleted.
        </p>
      )}
      <p className="text-small font-semibold uppercase tracking-widest text-accent-text">WeddingVista</p>
      <h1 className="text-display max-w-3xl">See your venue decorated, with honest prices.</h1>
      <p className="max-w-xl text-muted">The couple journey arrives in a later phase. Vendors can already list venues and spaces.</p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/sign-up"
          className="inline-flex min-h-11 w-fit items-center rounded-full bg-accent px-6 font-semibold text-on-accent transition-colors hover:bg-accent-hover"
        >
          Create an account
        </Link>
        <Link
          href="/sign-up?role=vendor"
          className="inline-flex min-h-11 w-fit items-center rounded-full border border-line-strong bg-surface px-6 font-semibold text-ink hover:bg-subtle"
        >
          I&apos;m a vendor
        </Link>
        <Link href="/sign-in" className="inline-flex min-h-11 items-center px-3 font-semibold text-accent-text underline underline-offset-4">
          Sign in
        </Link>
      </div>
    </main>
  );
}
