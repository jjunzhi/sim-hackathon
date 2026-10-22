// Single source of truth for colour tokens. Plain ESM so the contrast script
// (node scripts/check-contrast.mjs) can import it without a build step.
// globals.css mirrors these values; src/design/tokens.test.ts fails on drift.

/** @typedef {Record<string, string>} Palette */

/** Couple theme (light, default). */
export const couple = {
  "bg-primary": "#FBF7F2",
  "bg-surface": "#FFFFFF",
  "bg-subtle": "#F1E9DF",
  "text-primary": "#2A2325",
  "text-muted": "#6F6468",
  "accent": "#B84C60",
  "accent-hover": "#A84457",
  "accent-text": "#A84457",
  "on-accent": "#FFFFFF",
  "accent-tint": "#F9ECEF",
  "gold": "#B8935A",
  "border": "#E6DDD3",
  // Added: decorative #E6DDD3 cannot reach 3:1, so form controls use this.
  "border-strong": "#8E8079",
  "success": "#3B6E52",
  "warning": "#8F5A12",
  "warning-icon": "#B86B1B",
  "error": "#B43C3C",
};

/** Vendor portal theme (dark, .vendor-dark). */
export const vendor = {
  "bg-primary": "#161314",
  "bg-surface": "#221D1F",
  "bg-subtle": "#2D2629",
  "text-primary": "#F7F3EE",
  "text-muted": "#B0A4A8",
  "accent": "#D46A7E",
  "accent-hover": "#E07D90",
  // Same rule as couple (accent text = hover colour): #D46A7E is only 4.3:1 on bg-subtle.
  "accent-text": "#E07D90",
  "on-accent": "#161314",
  "accent-tint": "#3A2227",
  "gold": "#CFA86B",
  "border": "#383033",
  "border-strong": "#85787C",
  "success": "#68A682",
  "warning": "#E59A4B",
  "warning-icon": "#E59A4B",
  "error": "#E26D6D",
};

export const themes = { couple, vendor };

const BACKGROUNDS = ["bg-primary", "bg-surface", "bg-subtle"];

/**
 * Every foreground/background pair the UI uses, with the WCAG level it must
 * meet. "text" = 4.5:1, "large" = 3:1 (large text), "ui" = 3:1 (component
 * boundaries, icons, focus rings), "decorative" = reported, no requirement.
 */
export const pairs = [
  ...["text-primary", "text-muted", "accent-text", "success", "warning", "error"].flatMap((fg) =>
    BACKGROUNDS.map((bg) => ({ fg, bg, level: "text" })),
  ),
  { fg: "text-primary", bg: "accent-tint", level: "text" },
  { fg: "accent-text", bg: "accent-tint", level: "text" },
  { fg: "on-accent", bg: "accent", level: "text", note: "primary button" },
  { fg: "on-accent", bg: "accent-hover", level: "text", note: "primary button hover" },
  ...BACKGROUNDS.map((bg) => ({ fg: "accent", bg, level: "ui", note: "focus ring, slider fill, checkbox" })),
  ...BACKGROUNDS.map((bg) => ({ fg: "border-strong", bg, level: "ui", note: "input and control borders" })),
  ...BACKGROUNDS.map((bg) => ({ fg: "warning-icon", bg, level: "ui", note: "warning icon" })),
  ...BACKGROUNDS.map((bg) => ({ fg: "gold", bg, level: "decorative", note: "never carries meaning" })),
  ...BACKGROUNDS.map((bg) => ({ fg: "border", bg, level: "decorative", note: "card dividers only" })),
];

export const REQUIRED_RATIO = { text: 4.5, large: 3, ui: 3, decorative: 0 };
