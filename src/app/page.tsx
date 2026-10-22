import Link from "next/link";
import { Calculator, Heart, MapPinned, Sparkles } from "lucide-react";
import { HeroCrossfade } from "@/components/hero-crossfade";

const STEPS = [
  { icon: MapPinned, title: "Choose a venue", body: "Real Singapore venues with their real rooms, guest numbers and prices." },
  { icon: Sparkles, title: "See it decorated", body: "Pick a style and the vendor's own decor, and see that room dressed for your day." },
  { icon: Calculator, title: "Know the cost", body: "An itemised estimate with every fee shown: no surprises later." },
  { icon: Heart, title: "Decide together", body: "Share your favourite options with family and see where everyone agrees." },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ accountDeleted?: string }> }) {
  const { accountDeleted } = await searchParams;
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="container-page flex min-h-16 items-center justify-between gap-4">
          <span className="font-display text-h3 text-ink">WeddingVista</span>
          <nav aria-label="Main" className="flex items-center gap-1">
            <Link href="/venues" className="inline-flex min-h-11 items-center rounded-full px-3 text-small font-semibold text-muted hover:text-ink">
              Venues
            </Link>
            <Link href="/sign-in" className="inline-flex min-h-11 items-center rounded-full px-3 text-small font-semibold text-muted hover:text-ink">
              Sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="container-page flex flex-col gap-16 py-10 sm:py-16">
        {accountDeleted === "1" && (
          <p role="status" className="w-fit rounded-xl border border-success bg-surface px-4 py-3 text-small font-medium text-success">
            Your account and data have been deleted.
          </p>
        )}
        <section className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,34rem)]">
          <div className="flex flex-col gap-6">
            <p className="text-small font-semibold uppercase tracking-widest text-accent-text">Weddings in Singapore</p>
            <h1 className="text-display">See your venue decorated, with honest prices.</h1>
            <p className="max-w-xl text-body text-muted">
              Pick a real room, choose decor the vendor can actually deliver, and get an itemised estimate before you commit.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/venues"
                className="inline-flex min-h-13 items-center rounded-full bg-accent px-7 font-semibold text-on-accent shadow-soft transition-colors hover:bg-accent-hover"
              >
                Find a venue
              </Link>
              <Link href="/sign-up?role=vendor" className="inline-flex min-h-11 items-center px-3 font-semibold text-accent-text underline underline-offset-4">
                I&apos;m a vendor
              </Link>
            </div>
          </div>
          <HeroCrossfade />
        </section>

        <section aria-labelledby="how" className="flex flex-col gap-6">
          <h2 id="how" className="text-h2">
            How it works
          </h2>
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="flex flex-col gap-2 rounded-card border border-line bg-surface p-5 shadow-soft">
                <span className="flex items-center gap-2 text-gold">
                  <Icon aria-hidden className="size-5" />
                  <span className="num text-small font-semibold text-muted">Step {i + 1}</span>
                </span>
                <h3 className="text-h3">{title}</h3>
                <p className="text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
