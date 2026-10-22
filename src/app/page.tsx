import Link from "next/link";

export default function Home() {
  return (
    <main className="container-page flex min-h-dvh flex-col justify-center gap-6 py-16">
      <p className="text-small font-semibold uppercase tracking-widest text-accent-text">WeddingVista</p>
      <h1 className="text-display max-w-3xl">See your venue decorated, with honest prices.</h1>
      <p className="max-w-xl text-muted">The couple journey arrives in a later phase. For now, this build holds the design foundation.</p>
      <Link
        href="/design"
        className="inline-flex min-h-11 w-fit items-center rounded-full bg-accent px-6 font-semibold text-on-accent transition-colors hover:bg-accent-hover"
      >
        View the design system
      </Link>
    </main>
  );
}
