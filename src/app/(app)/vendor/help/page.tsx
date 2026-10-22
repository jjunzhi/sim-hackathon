"use client";

import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { FeedbackBox } from "@/components/vendor/feedback-box";
import { useVendor } from "@/lib/vendors/vendor-context";

/**
 * Short answers to what pilot vendors ask first. Plain words, no jargon; each
 * section links to the screen where the thing is done.
 */
const TOPICS: Array<{ id: string; title: string; body: React.ReactNode }> = [
  {
    id: "estimates",
    title: "How couples' estimates are worked out",
    body: (
      <>
        <p>
          Every estimate uses only your own prices: room rental for the chosen Peak or Off-Peak tier, then each item at its unit (per piece, per table of
          your table size, or per guest). If the total is below your minimum spend, couples see a separate &quot;Minimum spend shortfall&quot; line; we never
          raise prices silently. Your service charge and GST are added at the rates you set, and every line is shown.
        </p>
        <p>
          Check any combination yourself in <Link href="/vendor/estimate-preview">Estimate preview</Link>. Tax settings are on the{" "}
          <Link href="/vendor/business">Business</Link> page.
        </p>
      </>
    ),
  },
  {
    id: "renders",
    title: "What couples see in renders",
    body: (
      <p>
        Renders start from the photo of your empty room and add only items you list, with a photo. Every render is labelled as an AI illustration that may
        differ from the real decor. Items without a photo still appear in estimates but not in renders. Renders of your rooms count towards your monthly
        render allowance, shown on your <Link href="/vendor">Overview</Link>.
      </p>
    ),
  },
  {
    id: "confirm",
    title: "What confirming an estimate commits you to",
    body: (
      <p>
        When a couple asks you to confirm, you see their guests, room, the items they chose from you, their saved renders and the contact details they shared.
        Confirming freezes those exact lines and totals until the date you choose (14 days by default). Later price changes don&apos;t affect it, and you
        can&apos;t edit a confirmation. Couples see &quot;Vendor Confirmed&quot; only for your part; other vendors confirm their own. Find requests under{" "}
        <Link href="/vendor/leads">Leads</Link>.
      </p>
    ),
  },
  {
    id: "booked",
    title: "Marking a booking",
    body: (
      <p>
        When a couple you confirmed books with you, open the lead and choose &quot;Mark as booked&quot; with the event date. Adding the booked value is optional.
        The couple is asked to confirm it. Confirmed bookings appear on <Link href="/vendor/billing">Plan and billing</Link>. During the pilot no commission is
        charged.
      </p>
    ),
  },
  {
    id: "statements",
    title: "Dietary, access and booked dates",
    body: (
      <p>
        Dietary tags on food, the menus you cater for, and your access details are shown to couples as your own statements, and couples filter by them. Tick
        only what is really in place. Couples can check halal certificates on the MUIS halal search. Dates you&apos;re already booked go on the{" "}
        <Link href="/vendor/business">Business</Link> page; couples see the dates only, never your notes.
      </p>
    ),
  },
  {
    id: "plan",
    title: "Your plan",
    body: (
      <p>
        Pilot vendors list for free until the date on their invite. After that, or without an invite, the monthly plan keeps you in the catalog. If a payment
        fails you stay listed for a week while it&apos;s retried. If the plan ends, couples can&apos;t find you in the catalog, but nothing is deleted. See{" "}
        <Link href="/vendor/billing">Plan and billing</Link>.
      </p>
    ),
  },
  {
    id: "privacy",
    title: "Couples' personal data",
    body: (
      <p>
        You receive only what a couple chose to share with you in their request. Use it to reply to that request. If a couple deletes their account, their
        contact details are removed from your leads, while the confirmation you gave is kept for your records.
      </p>
    ),
  },
];

export default function HelpPage() {
  const vendor = useVendor();
  return (
    <main className="container-page flex flex-col gap-8 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1">Help</h1>
        <p className="max-w-2xl text-muted">The short version of how WeddingVista works for your business.</p>
        <nav aria-label="Help topics">
          <ul className="flex flex-wrap gap-2">
            {TOPICS.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-3 text-small font-semibold hover:bg-subtle">
                  {t.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="flex max-w-3xl flex-col gap-5">
        {TOPICS.map((t) => (
          <Card key={t.id}>
            <CardBody className="flex flex-col gap-3 [&_a]:font-semibold [&_a]:text-accent-text [&_a]:underline [&_a]:underline-offset-4">
              <h2 id={t.id} className="scroll-mt-24 text-h3">
                {t.title}
              </h2>
              {t.body}
            </CardBody>
          </Card>
        ))}
      </div>
      <section aria-labelledby="fb-h" className="flex max-w-3xl flex-col items-start gap-2">
        <h2 id="fb-h" className="text-h3">
          Still stuck?
        </h2>
        <p className="text-muted">Tell us what you were trying to do. It helps us fix things for every vendor.</p>
        {vendor.status === "ready" && <FeedbackBox uid={vendor.uid} />}
      </section>
    </main>
  );
}
