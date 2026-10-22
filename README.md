# WeddingVista (working name)

A Singapore wedding venue and decor platform. Vendors load their real spaces, decor and prices. Couples see their chosen room decorated with only items the vendor can deliver, and get an honest itemised estimate.

**Status: Phase 4, the couple journey.** It covers:

- the landing page and the venue catalog with filters;
- venue pages and the Studio (room, guests, tiers, style, render, live estimate);
- saved plans, the guest helper, and a print/PDF estimate.

Earlier phases: **Phase 3**, the AI render (server-side, cached, with limits and a DEMO mode); **Phase 2**, inventory and the estimate engine. Builds on Phase 1 (auth, roles, PDPA consent, venue onboarding, photo uploads, security rules, account deletion). Phase 2 adds:

- business profiles with decorator onboarding;
- inventory and packages;
- the estimate engine;
- a vendor estimate preview.

Everything runs on the local Firebase emulators; nothing is deployed.

## Requirements

- Node.js **24.12 or newer**. The Firebase JS SDK 13 and `@firebase/rules-unit-testing` 6 require it.
- **Java (JDK 21 LTS recommended; Firebase documents 11 as the minimum)** for the Firebase emulators.
- Chrome or Edge, only for `npm run screenshots`.

## First run (local, no Google account needed)

```bash
npm install
npm run functions:install
cp .env.example .env.local   # already set up for the emulators
```

Then, in two terminals:

```bash
npm run emulators      # Auth, Firestore, Storage, Functions; UI at http://127.0.0.1:4000
npm run dev            # http://localhost:3000
```

The emulators use the project ID `demo-weddingvista`. A `demo-` project only ever exists on your machine, and the app refuses to run in emulator mode with any other project ID.

## Tests

```bash
npm test               # unit tests: money, capacity, validation, image sizing, config (no emulators)
npm run test:rules     # Firestore and Storage security rules, against the emulators
npm run test:functions # account deletion end to end, against the emulators
npm run test:all       # all three
npm run check:contrast # WCAG AA table for every colour pair in both themes
npm run typecheck && npm run lint && npm run build
```

`test:rules` and `test:functions` start and stop the emulators themselves through `firebase emulators:exec`, so don't run them while `npm run emulators` is already running.

**UI walkthrough:** with `npm run emulators` (fresh data) and `npm run dev` running, run:

```bash
node scripts/e2e-phase2.mjs
```

It drives a real Chrome through decorator sign-up, inventory, a package, publishing and the estimate preview. It checks the totals against `docs/estimate-examples.md` and saves screenshots to `docs/screenshots/phase2`.

## Planning assistant, SAMPLE venues and launch pages

- **Planning assistant** ("Plan with AI" in the Studio; `?assistant=1` opens it). A chat in the couple's language that suggests changes to the plan: guests, room, Peak or Off-Peak, theme, items from the venue's and listed decorators' real inventory, and the wedding date.
  - Every suggestion is checked against real data on the server (`functions/src/assistant/proposal.ts`) and shown with its effect on the estimate. Nothing changes until the couple taps **Apply**.
  - Model: `gemini-3.5-flash-lite` (stable), called from the `planAssistant` Cloud Function with the same `GEMINI_API_KEY` secret as renders. With no key it runs a labelled DEMO that understands simple requests.
  - Limits: 30 messages per couple per day and 3,000 in total per day; override them in `config/assistantLimits`. Conversations are not stored; only the last 12 messages are sent each time.
- **SAMPLE venues**: `npm run sample-venues -- load --emulator` (or `--project <id>`) loads 9 SAMPLE venues and 3 SAMPLE decorators with rooms, menus, dietary tags, access details and booked dates. The catalog then shows "These are SAMPLE listings for demonstration". `npm run sample-venues -- remove ...` deletes them all, including cached renders. Every name, address and price is fictional and labelled SAMPLE; addresses name only an area.
- **Room photos** are licensed stock photos (Pexels and Unsplash), checked by eye for people and logos, cropped and stripped of metadata. They are in `scripts/sample-venues/photos`, with credits in `CREDITS.md`. Rooms without a suitable photo use illustrated SAMPLE scenes.
- **Launch pages**:
  - `/privacy` (a DRAFT notice, to be reviewed against the PDPA, linked from sign-up and the landing page).
  - A branded 404 and error page.
  - `robots.txt` (family links `/s/` and signed-in areas are never indexed) and `sitemap.xml`.
  - A share preview image, and page metadata from `NEXT_PUBLIC_SITE_URL`.
  - Security headers in `next.config.ts`. A full Content-Security-Policy is still to do; it needs a tested allow-list for Firebase, reCAPTCHA and Maps.

Walkthrough (fresh emulators, `npm run sample-venues -- load --emulator`, dev server running):

```bash
node scripts/e2e-launch.mjs
```

## Pilot and billing (Phase 7)

- **Who is listed.** A vendor appears in the catalog (and as a decorator in the Studio) only while its plan is in good standing: a pilot within its dates, an active or trialing Stripe subscription, or a failed payment still inside its 7-day grace period. The server writes a `listed` flag on `vendors/{uid}` and on each venue, and the catalog queries and rules both require it, so no client can list itself. Lapsing hides a vendor from discovery only. Saved plans, family links, leads and confirmations keep working, and nothing is deleted. The rules in `functions/src/billing/standing.ts` are shared by the webhook, the daily sweep, the admin scripts and the vendor's Plan page.
- **Pilot invites.** `npm run admin -- invite --until 2027-01-31 --note "SAMPLE venue" --project <id>` prints a link like `/sign-up?role=vendor&invite=<code>`. Opening it preselects the vendor role. After sign-up (email or Google), the vendor area redeems the code once (`redeemInvite`), which makes the account a pilot vendor, free until that date. Codes are 128 random bits and single-use. Vendors can also type a code on the Plan page.
- **Subscription (Stripe).**
  - "Choose the monthly plan" opens Stripe Checkout in subscription mode, for cards (`createCheckoutSession`). "Manage billing" opens the Stripe Customer Portal for card changes, invoices and cancelling (`createPortalSession`).
  - The `stripeWebhook` function verifies the signature on the raw body, applies each event once (`stripeEvents/{id}`), and ignores events older than the last one applied, because Stripe doesn't guarantee order.
  - Status lives in `billing/{uid}`. Vendors can read it; only the server writes it.
  - A daily job (`dailyListingSweep`, 03:00 Singapore time) ends pilots and grace periods on time.
  - Deleting a vendor account cancels its subscription first.
  - PayNow can't be charged automatically for subscriptions (Stripe only supports it on emailed invoices), so it's left for later.
- **Price and wording.** S$35 a month, set by `NEXT_PUBLIC_PLAN_PRICE_CENTS` for display and `STRIPE_PRICE_ID` for the charge; keep them in step. The note "No GST is charged on the plan." is configurable (`NEXT_PUBLIC_PLAN_PRICE_NOTE`). Change it if you register for GST; IRAS's threshold is S$1 million taxable turnover.
- **Bookings.** On a confirmed lead, the vendor can "Mark as booked" with the event date and, optionally, the booked value. The couple sees the claim under that vendor in the Studio estimate and answers "Yes, we booked" or "That's not right". Only confirmed bookings count. They appear on the vendor's Plan page as a monthly statement. **Commission is 0% during the pilot and nothing is charged**; `npm run admin -- set-commission <uid> <bps>` sets a rate (up to 5%) and the statement shows it, but charging it is not built.
- **Onboarding without help.**
  - A "Get set up" checklist on the vendor Overview is worked out from the vendor's real data (`src/lib/vendors/setup-steps.ts`). Each step links to where it's done.
  - A readiness list flags what would confuse couples, such as rooms without photos or a venue without an address.
  - Publishing needs a plan in good standing and says how to get one.
  - A Help page answers the first questions, and "Send feedback" stores free text and the page it came from (`feedback/{id}`, readable only in the console).
- **Admin scripts** (`scripts/admin.mjs`, Admin SDK with your Application Default Credentials):
  - `invite` and `extend-pilot` manage pilot access.
  - `set-commission` sets a vendor's rate.
  - `verify <venueId> [--off]` adds or removes the Verified badge.
  - `sync <uid>` recomputes a vendor's listing.
  - `export-pilot` prints a CSV of each vendor's milestones (signed up, first venue, published, listed, first lead, first confirmation, first booking, feedback count) to show where pilot vendors stall. It exports no couple data.
  
  Every command needs `--project <id>` or `--emulator`.
- **Deletion.** A vendor's billing record, bookings and feedback go with the account, and a redeemed invite keeps only that it was used. A couple's side of a booking follows option B, like confirmed leads, and is **pending PDPA review**.

UI walkthrough (fresh emulators, `npm run seed`, dev server running):

```bash
node scripts/e2e-phase7.mjs
```

## Deploy (Firebase App Hosting)

You run these on your own project; nothing here deploys automatically. Check the current App Hosting docs first: when this was written, the supported-frameworks and quickstart pages didn't load, so **confirm that Next.js 16 is supported and that `asia-southeast1` is offered** when you create the backend.

1. Finish **Firebase setup** above (Blaze plan, asia-southeast1, Auth, App Check, budget alert).
2. **Stripe (sandbox first):**
   - Create the product "WeddingVista vendor plan" with a monthly S$35 price, and put its `price_...` in `functions/.env` as `STRIPE_PRICE_ID` (see `functions/.env.example`), with `APP_BASE_URL` set to your site.
   - In Stripe, turn on the Customer Portal, allowing card updates, invoices and cancellation.
3. **Secrets for Functions:**
   - `npx firebase functions:secrets:set STRIPE_SECRET_KEY` (your `sk_test_...` key first, then `sk_live_...`).
   - `npx firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`.
   - `GEMINI_API_KEY` as in Phase 3.
4. **Deploy rules and functions:** `npx firebase deploy --only firestore,storage,functions --project <id>`.
5. **Webhook:** in Stripe, add an event destination for the `stripeWebhook` URL (`https://asia-southeast1-<id>.cloudfunctions.net/stripeWebhook`). Send `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
   - To test locally against a Stripe sandbox, run `stripe listen --forward-to http://127.0.0.1:5001/<id>/asia-southeast1/stripeWebhook` and use the secret it prints.
6. **App Hosting backend:**
   - Run `npx firebase apphosting:backends:create --project <id>`. It connects your GitHub repository and live branch.
   - Fill in the public Firebase config in `apphosting.yaml`, as listed in its comments.
   - Grant secret access if you add any with `npx firebase apphosting:secrets:grantaccess <name>`.
7. Add your App Hosting domain to the App Check reCAPTCHA key and to the Maps key's allowed referrers.
8. Create the first pilot invites with `npm run admin -- invite --until <date> --project <id>`, and send each vendor their link.

## Before launch: what only you can do

Each item is something the code can't do on its own; the code side is already in place.

- [ ] **PDPA review of option B** (confirmed leads and bookings kept without the couple's details after deletion): `functions/src/deletion.ts`.
- [ ] **Native-speaker review** of `src/lib/i18n/dictionaries/zh.ts`, `ms.ts` and `ta.ts`; then set each `status` to `"reviewed"` to remove the "draft translation" note.
- [ ] **Community review** of the ritual checklists (`src/lib/i18n/dictionaries/en/rituals.ts` and the translations); remove the badge in `src/app/(app)/checklists/page.tsx` once reviewed.
- [ ] **Consent wording**: replace the DRAFT consent text and bump `CONSENT_VERSION` in `src/lib/legal.ts`.
- [ ] **GST**: confirm the S$1 million threshold on the IRAS site and keep `NEXT_PUBLIC_PLAN_PRICE_NOTE` accurate.
- [ ] **Stripe**: switch from sandbox to live keys and Price, with the webhook pointing at production.
- [ ] **Maps key**: restricted to the Maps Embed API and your domains.
- [ ] **Budget alert** set, and the render limits (`config/renderLimits`) chosen for the pilot.
- [ ] **App Check** enforced, with the domains registered.

## Culture and inclusion (Phase 6)

- **Languages:** English, 中文 (Simplified Chinese), Bahasa Melayu and தமிழ் on every couple screen and the family vote page; the vendor portal stays English. The language menu sits in the header. The choice is kept in this browser (`localStorage`) and, for signed-in users, on the profile (`users/{uid}.locale`, the one profile field a user may change), so it follows them to another device. `<html lang>` follows the choice, and dates use `Intl` in that language, in Singapore time.
  - How it works: `src/lib/i18n`. A small typed `t(key, vars)` with `{name}` placeholders and plurals through `Intl.PluralRules` (`key_one` / `key_other`). English is the reference (`dictionaries/en/*.ts`, one file per screen); the other languages load on demand. No i18n library and no `/[lang]/` URLs: every app screen renders on the client, so locale routing would add a proxy and a route segment without any SEO gain.
  - **The Chinese, Malay and Tamil dictionaries are drafts** (`status: "draft"` in `dictionaries/zh.ts`, `ms.ts`, `ta.ts`). Until a native speaker reviews one and its status is set to `"reviewed"`, readers in that language see a one-line note that the translation is under review. Vendor-entered text (venue and item names, descriptions) is never translated.
  - `npm test` fails if a language is missing a key, has an extra one, or drops a `{placeholder}`.
  - Chinese and Tamil switch both fonts to Noto Sans SC and Noto Sans Tamil (self-hosted through `next/font`), because Fraunces and Plus Jakarta Sans have no glyphs for those scripts.
- **Ritual checklists** (`/checklists`): Chinese Tea Ceremony, Malay Akad Nikah and Sanding, Indian Vivaha and Sangeet, and ROM Solemnization, with items for before and on the day. Ticks and the couple's own items are saved per couple in `checklists/{uid}` (owner only) and deleted with the account. **All checklist content is a draft that needs community review**, and the page says so. The structure is in `src/lib/rituals/content.ts` and the wording is in the dictionaries under `ritual.*`, so reviewers edit text without touching code.
- **Dietary:** "Food and drink" items can carry halal, vegetarian, vegan, no beef and no pork tags. Venues can list the menus they cater for. Couples filter the catalog by menus and the Studio's food items by tag; decor is never hidden. These are always the **vendor's statements**: the UI says so, and halal venues link to the [MUIS halal search](https://halal.muis.gov.sg/halal/establishments) so couples can check a certificate. We make no certification claims.
- **Access:** besides wheelchair and lift access, venues can declare a step-free entrance, an accessible toilet and accessible parking. The catalog filters on all five. Anything not declared reads "not listed", never "no". Venues and items saved before Phase 6 have none of the new fields, and the rules accept them as they are.
- **Maps:** the venue page shows a Google Maps Embed (`place` mode) when `NEXT_PUBLIC_MAPS_EMBED_KEY` is set, plus "Open in Google Maps" and "Directions" links, which need no key. Google lists the Embed API as free with unlimited requests, but the key is public in the browser, so **restrict it in Google Cloud to the Maps Embed API and to your site's HTTP referrers**. Without a key (local and CI) the page shows the links and a note instead of a map. We never geocode or store coordinates.
- **Calendar (light):** a plan has an optional wedding date. In the Estimate step, "Add to calendar" downloads an all-day `.ics` (RFC 5545; it opens in Google, Apple or Outlook calendars). Vendors list booked dates by hand on their Business page (`vendors/{uid}/blockedDates`; only the date is public, once the business is published). The venue page lists them, and the Studio warns when the chosen date is one of them. Two-way Google Calendar sync is left for the pilot: it needs a verified OAuth consent screen and server-side token storage.

UI walkthrough (fresh emulators, `npm run seed`, dev server running):

```bash
node scripts/e2e-phase6.mjs
```

## Family links, voting and vendor confirmation (Phase 5)

- **Family links** (`shares/{id}`): a couple puts 2 or 3 saved renders, from any of their plans, side by side under one question. The id is 128 random bits (22 characters, base64url), so a link can't be guessed; anyone with the link can open it. Each option shows its plan's estimate total at the moment the link was made, with the Estimate badge and the AI illustration note.
- **Voting needs no account.** The page signs the visitor in anonymously (**Firebase Anonymous Auth must be enabled in the console** before launch; the emulator has it on). An anonymous session can only read a link and cast one vote; it can't create a profile, a plan or a render. Votes are keyed by the voter's uid and are create-only, so one browser identity votes once and can't change it. Clearing site data gives a new identity, so "one vote per person" is best effort, and the couple can vote on their own link. Voters see only a thank-you and their own choice.
- **Stored per vote:** the option, an optional name or relationship (40 characters) and an optional note (280). No IP addresses, no contact details.
- **Results** are for the couple only: percentages by the largest-remainder method, a leader, and "most agree" when one option has 70% or more.
- **Turning a link off** keeps the document (so the page can say "no longer active") but empties its options and title. **Deleting** a link deletes its votes too. A deleted couple's links read "This project has been removed".
- **Confirmed estimates** (`leads/{id}` and `confirmations/{id}`): from the Estimate step, a couple asks one vendor at a time to confirm its own part ("Request a confirmed estimate"), typing a name, an email or phone, an optional date and message, and ticking a consent box. The vendor sees the guests, room, its own chosen items (never another vendor's), the saved renders and those details, and confirms or declines. Confirming freezes the engine's estimate as a snapshot, valid until a date the vendor picks (14 days by default, 1 to 90). The rules make confirmations write-once and check that they match the lead; the vendor's browser does the pricing with the shared engine (`engineVersion` is recorded).
- **What the couple sees:** the confirmed part carries "Vendor Confirmed · Valid until …" and keeps the confirmed lines and totals even when the vendor changes prices later. It drops back to an Estimate when the date passes or when the couple changes that part of the plan (guests, room, tier or that vendor's items). The print view, the plan cards and the vendor's leads table all use the same resolution.
- **Deletion cascade:** a couple's links and all their votes go with the couple, and so do unconfirmed leads. Confirmed leads follow **option B, pending PDPA review before launch**: the vendor keeps its confirmation snapshot (prices and items) but the couple's contact details, renders and plan link are removed, and the lead is marked `anonymised`. A vendor's leads and confirmations are deleted with the vendor.

UI walkthrough (fresh emulators, `npm run seed`, dev server running; it drives two browsers, one for the couple or vendor and one for a family member with no account):

```bash
node scripts/e2e-phase5.mjs
```

## Couple journey (Phase 4)

- **Browsing needs no account.** Rendering and saving a plan need a couple account. A plan made before signing up survives the sign-up step. It's kept in this tab's `sessionStorage` until saved, and holds no personal data.
- **Catalog filters:** guest count (one room must fit), wheelchair access, lift access, style and culture. The guest range and "from" price come from `capacitySummary`. The `venueCapacitySummary` Firestore trigger (asia-southeast1) writes it whenever a space changes, and vendors can't edit it.
- **Studio steps:** Venue (room, Peak/Off-Peak, guests), Style (theme, items from the venue and from decorators who work there), Render, Estimate, and Share (family links, Phase 5).
  - The guest slider runs from half the room's minimum to 30% above its maximum, with warnings either side.
  - There's one estimate per vendor, plus the total across vendors.
- **Plans** (`projects/{id}`) are owner-only, up to 10 per couple, and autosave. They hold up to 6 saved renders.
- **Guest helper** (`guestLists/{uid}/parties`): a label, a tier, seats and plus-ones only, never contact details. It shows seats against the chosen plan's room and cost per guest. The trim suggestion follows the couple's own order and never suggests "Must invite". Nothing scores or rates people.
- **Print:** `/plans/{id}/print` has an A4 print stylesheet with a white background and no navigation. Use the "Print or save as PDF" button.
- **SAMPLE data for the emulators:** run `npm run seed` while `npm run emulators` is running. It only ever targets the local `demo-` project.

UI walkthrough (fresh emulators, `npm run seed`, dev server running):

```bash
node scripts/e2e-phase4.mjs
```

## AI renders (Phase 3)

`requestRender` is a Cloud Function in asia-southeast1. It renders the real room photo decorated with only the selected, deliverable items, using Gemini (`gemini-nano-banana-2.1`, 1K) through `@google/genai`.

- **The API key stays on the server.** Set it with `npx firebase functions:secrets:set GEMINI_API_KEY`. For the emulators, put it in `functions/.secret.local`, which is git-ignored. Never use a `NEXT_PUBLIC_` variable. A scan of the built browser files finds no key, SDK or endpoint.
- **DEMO mode** runs when the key is empty, `demo` or `none`, which is the default in `functions/.secret.local`. It takes the real room photo, adds a theme colour wash, and stamps "DEMO PREVIEW · not an AI render" on it. No AI service is called and nothing is spent. Caching and limits work exactly as in real mode.
- **Cache:** the key is a SHA-256 of the space, the space photo version, the theme, the sorted item IDs (each with its photo revision), the prompt-template version and the model. A hit uses no quota and no API call.
  - Renders contain no personal data and are shared between couples.
  - Deleting a vendor deletes renders of their rooms or items.
- **Limits** (Singapore days and months):
  - 10 per person per day and 40 per month;
  - 300 per vendor per month;
  - 200 per day in total.

  An admin overrides any of these in the Firestore document `config/renderLimits`, using the fields `userPerDay`, `userPerMonth`, `vendorPerMonth` and `globalPerDay`. Quota is reserved before the call and refunded if it fails.
- **Who can render:**
  - A couple can render published venues; a vendor can also render its own drafts.
  - Items must be active and have a photo.
  - Items must come from the venue's owner, or from a published decorator who works at that venue.
- **Cost:** about US$0.034 per real render at 1K. There's no free tier for image output, so set the budget alert below before adding a real key.
- **Data use:** Gemini's paid-tier terms say prompts and images aren't used to improve Google's products, but are logged for a limited time to check for misuse. Every image carries Google's SynthID watermark.
- **Theme wording** needs community review before launch (`functions/src/render/themes.ts`).

UI walkthrough (fresh emulators and dev server running):

```bash
node scripts/e2e-phase3.mjs
```

## Estimate engine

`src/lib/estimate/engine.ts` is pure and unit-tested, with one estimate per vendor. The order is:

1. Room rental for the chosen tier.
2. Items and packages: per piece = price x quantity; per table = price x ceil(guests / seats per table); per guest = price x guests.
3. Subtotal.
4. Minimum-spend shortfall, shown as its own line, never silently added.
5. Service charge.
6. GST on the subtotal plus service charge.
7. Total and per-guest price.

Rounding is half-up at each step. What counts towards the minimum spend is decided in one function, `minimumSpendBasis`. Every number in `docs/estimate-examples.md` was worked by hand and is asserted by the tests.

## Firebase setup (real project, later)

1. Create a Firebase project and **upgrade it to the Blaze plan**. Cloud Storage and Cloud Functions both need Blaze (Storage since February 2026, even for old buckets).
2. Choose **asia-southeast1 (Singapore)** for Firestore and Storage. This can't be changed later.
3. Enable **Authentication**, with the Email/Password and Google providers.
4. Add a **Web app** and copy its config into `.env.local`. Set `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=false`.
5. **App Check:** create a score-based reCAPTCHA Enterprise key, register it in App Check, and set `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY`. Don't add `localhost` to the key's domains; use an App Check debug token for local testing instead.
6. Deploy the rules and functions: `npx firebase deploy --only firestore,storage,functions --project <your-project-id>`.

### Cost safety: set a budget alert

Do this before deploying anything to Blaze:

1. Open Google Cloud console > Billing > **Budgets & alerts** > Create budget.
2. Scope it to the WeddingVista project. Set a monthly amount, for example S$20 during the pilot.
3. Set alert thresholds at 50%, 90% and 100% of actual spend, and 100% of forecasted spend. Send them to billing admins plus your email.
4. Optionally connect the budget to Pub/Sub to cap spend automatically. Budgets only alert; they never stop charges on their own.

The deletion function is capped at 10 instances (`maxInstances`). Render quotas arrive in Phase 3.

## Accounts, roles and personal data

- **Roles:** `couple` or `vendor`, chosen once at sign-up. It is stored in `users/{uid}` with the PDPA consent record (consent text version plus server time). The rules allow creating this document once and never updating or deleting it from the client.
- **Minimum data:** the profile holds only role, consent and creation time. The email address lives in Firebase Auth only.
- **Consent wording** is in `src/lib/legal.ts`, marked DRAFT. Bump `CONSENT_VERSION` whenever the text changes.
- **Account deletion** (Account page) needs a fresh sign-in. It then calls the `deleteAccount` Cloud Function, which:
  - removes the user's Firestore data and Storage files using the steps in `functions/src/deletion.ts`;
  - then deletes the Auth account.

  Later phases add their own deletion steps there (renders, projects, share links, votes, leads).
- **"Verified"** is admin-only. Set `verified: true` on a venue in the Firebase console. The rules stop vendors from changing it.
- Re-encoding photos on the device strips EXIF metadata, including GPS location.

## Data model (Phase 1)

| Path | Who can read | Who can write |
| --- | --- | --- |
| `users/{uid}` | that user | that user, create only |
| `venues/{venueId}` | anyone if `status == "active"`; the owner always | vendors create their own drafts; the owner updates (never `verified` or `ownerUid`) |
| `venues/{venueId}/spaces/{spaceId}` | same as the venue | the venue owner |
| Storage `venues/{venueId}/**` | anyone if the venue is active; the owner always | the venue owner; WebP or JPEG only, up to 3 MB |
| `vendors/{uid}` (business profile) | anyone if published; the owner always | that vendor; never deleted from the client |
| `vendors/{uid}/items`, `/packages` | the owner; anyone if active and the business is published | that vendor (profile must exist) |
| Storage `vendors/{uid}/**` | the owner; anyone if the business is published | that vendor; WebP or JPEG only, up to 3 MB |

Prices are integer cents. Each space has one `standard` tier, or both `peak` and `offPeak`, each with `roomRentalCents` and an optional `minimumSpendCents`. Tax settings sit on the business profile and apply to all its venues, items and packages: service charge 1000 or 0 bps, GST 900 or 0 bps, plus editable notes shown when either is 0. Publishing a venue also publishes the business.

## Layout

| Path | What |
| --- | --- |
| `src/lib/money.ts` | Integer SGD cents, basis-point rates, half-up rounding, `tablesForHeadcount`, UI-only formatting |
| `src/lib/capacity.ts` | Capacity status and the "185 guests = 19 tables of 10" line |
| `src/lib/venues/*` | Venue and space types, validation (mirrors the rules), publish checklist |
| `src/lib/images/*` | On-device resize to 2048px, WebP with JPEG fallback, HEIC via `heic-to` |
| `src/lib/firebase/*` | Settings check (clear error, no fallback) and client initialisation |
| `src/lib/data/*` | Firestore and Storage reads and writes |
| `src/app/(app)/*` | Sign-up, sign-in, welcome, account, vendor area (client-rendered) |
| `functions/` | Cloud Functions (Node 24, asia-southeast1): `deleteAccount` |
| `firestore.rules`, `storage.rules` | Security rules; tests in `tests/rules` |
| `src/lib/motion.ts` | All shared durations, easings, transitions and variants |
| `src/design/tokens.mjs` | Colour tokens for both themes and the pairs the contrast script checks |
| `src/components/ui/*` | Base components |
| `legacy/index.html` | Earlier "Bersama" prototype, kept for reference only |

## Design decisions

- **Accessible primitives: Radix UI** (`radix-ui` package). It ships Dialog, Select, Slider, Checkbox and Toast with tested focus trapping, keyboard support and ARIA, and no styling of its own. Headless UI has no Slider or Toast.
- **Animation: Motion** (`motion`, imported from `motion/react`). `<MotionConfig reducedMotion="user">` turns off transform animations when the device asks for reduced motion.
- **Theme:** the couple light theme is the default. The vendor area adds `.vendor-dark` to `<html>`, so portalled overlays follow it.
- **Vendor `accent-text` is `#E07D90`.** `#D46A7E` fails the 4.5:1 text rule on `bg-subtle` and `accent-tint`.
- **Added token `border-strong`** for form controls, because `#E6DDD3` can't reach 3:1.
- **Overlays restore focus themselves**, because Radix only returns focus to its own `Dialog.Trigger`.
- **Roles live in a write-once Firestore document, not custom claims.** Setting claims at sign-up needs blocking functions, which need the paid Identity Platform upgrade.
- **HEIC is converted on the device only.** Safari 17+ decodes it natively. Other browsers load `heic-to` (LGPL-3.0, as a separate chunk) on demand. There is no server fallback, because `sharp` can't read HEIC. If conversion fails, the vendor is asked to export a JPEG.
- **Images are resized with plain canvas, not a library.** `browser-image-compression` hasn't been updated since 2023. Safari can't encode WebP and silently returns PNG, so the code checks the result type and falls back to JPEG.
- **Google sign-in uses a popup**, because redirect sign-in breaks when browsers block third-party storage.
