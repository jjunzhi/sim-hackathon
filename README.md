# WeddingVista (working name)

A Singapore wedding venue and decor platform. Vendors load their real spaces, decor and prices. Couples see their chosen room decorated with only items the vendor can deliver, and get an honest itemised estimate.

**Status: Phase 2, inventory and estimate engine.** Builds on Phase 1 (auth, roles, PDPA consent, venue onboarding, photo uploads, security rules, account deletion). Phase 2 adds:

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
