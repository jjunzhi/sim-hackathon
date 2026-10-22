# WeddingVista (working name)

A Singapore wedding venue and decor platform. Vendors load their real spaces, decor and prices. Couples see their chosen room decorated with only items the vendor can deliver, and get an honest itemised estimate.

**Status: Phase 0, design foundation.** No Firebase or Gemini yet.

## Requirements

- Node.js **22.22.2 or newer** (or 24.15+). Vitest 5 and jsdom 30 do not run on older 22.x releases.

## Commands

```bash
npm install
npm run dev            # http://localhost:3000, design system at /design
npm test               # unit tests (money, capacity, token drift)
npm run check:contrast # WCAG AA table for every colour pair in both themes
npm run typecheck
npm run lint
npm run build
npm run screenshots    # with dev server running: /design at 390/768/1366 in both themes -> docs/screenshots/phase0
```

`npm run screenshots` drives a local Chrome or Edge over the DevTools protocol, so viewport widths are exact. It also reports horizontal overflow and console errors for each capture. Set `REDUCED_MOTION=1` to capture with reduced motion emulated.

## Layout

| Path | What |
| --- | --- |
| `src/lib/money.ts` | Integer SGD cents, basis-point rates, half-up rounding, `tablesForHeadcount`, UI-only formatting |
| `src/lib/capacity.ts` | Capacity status and the "185 guests = 19 tables of 10" line |
| `src/lib/motion.ts` | All shared durations, easings, transitions and variants |
| `src/design/tokens.mjs` | Colour tokens for both themes and the list of pairs the contrast script checks |
| `src/app/globals.css` | CSS variables (mirrors tokens; a test fails on drift) and the Tailwind v4 theme |
| `src/components/ui/*` | Base components |
| `scripts/check-contrast.mjs` | `npm run check:contrast` |
| `public/samples/*` | Hand-drawn SAMPLE illustrations (original work, no licence concerns) |
| `legacy/index.html` | Earlier "Bersama" prototype, kept for reference only |

## Design decisions

- **Accessible primitives: Radix UI** (`radix-ui` package). It ships Dialog, Select, Slider, Checkbox and Toast with tested focus trapping, keyboard support and ARIA, and no styling of its own. Headless UI has no Slider or Toast. Modal and BottomSheet are both Radix Dialog with Motion animations. The before/after slider is custom (`role="slider"`), because it needs pointer-capture dragging over an image.
- **Animation: Motion** (`motion`, imported from `motion/react`). `<MotionConfig reducedMotion="user">` turns off transform animations when the device asks for reduced motion. Count-ups, pulses and shimmer are turned off separately.
- **Theme:** the couple light theme is the default. Adding `.vendor-dark` to `<html>` swaps every token, so portalled overlays follow the theme.
- **Vendor `accent-text` is `#E07D90`, not `#D46A7E`.** `#D46A7E` measures 4.34:1 on `bg-subtle` and 4.29:1 on `accent-tint`, which fails the 4.5:1 text rule. `#E07D90` is the vendor hover colour, matching the couple theme, where accent text equals hover (`#A84457`). Button backgrounds still use `#D46A7E`.
- **Overlays restore focus themselves.** Radix only returns focus to its own `Dialog.Trigger`. Our Modal and BottomSheet open from state, so they record the element that had focus when they open and return to it when they close.
- **Added token `border-strong`.** The specified border colour `#E6DDD3` is too faint to meet the 3:1 rule for form controls, so inputs, checkboxes and the slider track use `#8E8079` (light) or `#85787C` (dark). Card dividers keep `#E6DDD3`, where it is decorative.
