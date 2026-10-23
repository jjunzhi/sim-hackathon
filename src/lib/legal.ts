/**
 * The consent version lives here. The consent wording itself is in the i18n
 * dictionaries (keys auth.consent.label / auth.consent.summary, English
 * reference in src/lib/i18n/dictionaries/en/auth.ts). Reviewed by the
 * product owner on 2026-10-23. Bump CONSENT_VERSION whenever the wording
 * changes; it is stored with each person's consent record.
 */
export const CONSENT_VERSION = "2026-10-23";

/** Shown on estimates when a vendor does not charge GST or service charge. Vendors can edit their own. */
export const defaultTaxNotes = {
  noGstNote: "Prices not subject to GST",
  noServiceChargeNote: "No service charge",
};
