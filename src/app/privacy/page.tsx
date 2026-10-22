import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "What WeddingVista collects, why, who sees it, and how to delete it.",
};

/**
 * DRAFT privacy notice, written from what the app actually stores. It must be
 * reviewed against the PDPA (and by whoever is accountable for the data)
 * before launch; until then it says so at the top. English only for now:
 * legal wording should be settled before it is translated.
 */
const SECTIONS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: "What we collect",
    body: (
      <ul>
        <li>Your account: email address, whether you are a couple or a vendor, your consent record (which wording you agreed to and when), and your chosen language.</li>
        <li>Your plans: venue, room, guest numbers, theme, chosen items, saved renders and an optional wedding date, budget and day-of timeline.</li>
        <li>Your planning brief for Aria (optional): your style in your own words, traditions, food and access needs, and short notes. Please don&apos;t put names or contact details in it.</li>
        <li>Aria&apos;s decision log: which suggestions you applied, adjusted or set aside, and their effect on the estimate. It is stored with the plan and deleted with it.</li>
        <li>Your guest list helper: the labels you type for each party, tiers and seat counts. We never ask for guests&apos; names or contact details.</li>
        <li>Ritual checklists: which items you ticked and the items you added.</li>
        <li>Family voting: a family member&apos;s vote, plus an optional name or relationship and note. Voters don&apos;t need an account, and we don&apos;t store IP addresses.</li>
        <li>Estimate requests: the name, email or phone, optional date and message you choose to send to a vendor.</li>
        <li>Vendors: business details, listings, prices and photos, booked dates, and plan status from our payment provider. We never see card numbers.</li>
      </ul>
    ),
  },
  {
    title: "Who sees it",
    body: (
      <ul>
        <li>Your plans, guest list and checklists are visible only to you.</li>
        <li>Family links show only the renders and estimate totals you chose; votes are visible only to you.</li>
        <li>An estimate request goes only to the vendor you send it to, and only with that vendor&apos;s part of your plan.</li>
        <li>Service providers who run the service for us: Google Firebase (data stored in Singapore), Vercel (website hosting), Stripe (vendor payments) and Google&apos;s Gemini API (AI renders and Aria, the planning assistant).</li>
      </ul>
    ),
  },
  {
    title: "AI features",
    body: (
      <>
        <p>
          Renders send the room photo, the chosen items&apos; photos and the theme to Google&apos;s Gemini API. Aria, the planning assistant, sends your messages, this
          venue&apos;s rooms and prices, other listed venues, your current plan and brief, and your guest list&apos;s seat counts by tier (never the labels you
          typed), so it can suggest changes. We don&apos;t store the conversations; only the decisions you make are logged on your plan.
        </p>
        <p>
          <strong>To be confirmed before launch:</strong> whether Google may use these requests to improve its products depends on the Gemini plan our account uses.
          This notice will say which applies.
        </p>
      </>
    ),
  },
  {
    title: "Deleting your data",
    body: (
      <>
        <p>
          You can delete your account at any time from{" "}
          <Link href="/account" className="font-semibold text-accent-text underline underline-offset-4">
            Account
          </Link>
          . This removes your profile, plans, guest list, checklists, family links and their votes, and estimate requests that weren&apos;t confirmed.
        </p>
        <p>
          <strong>Under review:</strong> where a vendor already confirmed an estimate or recorded a booking for you, the vendor keeps that record (prices and items), but
          your contact details and the link to your plan are removed.
        </p>
      </>
    ),
  },
  {
    title: "Contact",
    body: <p>To ask about your data, contact the WeddingVista team. (Contact details to be added before launch.)</p>,
  },
];

export default function PrivacyPage() {
  return (
    <main className="container-page flex max-w-3xl flex-col gap-8 py-12">
      <Link href="/" className="font-display text-h3 text-ink">
        WeddingVista
      </Link>
      <div className="flex flex-col gap-3">
        <h1 className="text-h1">Privacy notice</h1>
        <p role="note" className="w-fit rounded-xl border border-warning-icon bg-surface px-4 py-2 text-small font-semibold text-warning">
          DRAFT wording, to be reviewed against the PDPA before launch.
        </p>
        <p className="text-muted">We collect the least we need to help you plan, and you can delete it yourself at any time.</p>
      </div>
      {SECTIONS.map((s) => (
        <section key={s.title} className="flex flex-col gap-3 [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-6">
          <h2 className="text-h2">{s.title}</h2>
          {s.body}
        </section>
      ))}
    </main>
  );
}
