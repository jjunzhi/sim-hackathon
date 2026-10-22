/**
 * Consent version and flags live here. The consent wording itself is in the
 * i18n dictionaries (keys auth.consent.label / auth.consent.summary /
 * auth.consent.draftNotice, English reference in src/lib/i18n/dictionaries/en/auth.ts).
 * DRAFT: not reviewed. Do not launch with this text.
 * Bump CONSENT_VERSION whenever the wording changes; it is stored with each
 * person's consent record.
 */
export const CONSENT_VERSION = "draft-2026-10-22";

export const CONSENT_IS_DRAFT = true;

/** Shown on estimates when a vendor does not charge GST or service charge. Vendors can edit their own. */
export const defaultTaxNotes = {
  noGstNote: "Prices not subject to GST",
  noServiceChargeNote: "No service charge",
};
