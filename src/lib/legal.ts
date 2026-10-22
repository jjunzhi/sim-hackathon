/**
 * Consent and legal wording lives here so it can be replaced without code
 * changes elsewhere. DRAFT: not reviewed. Do not launch with this text.
 * Bump CONSENT_VERSION whenever the wording changes; it is stored with each
 * person's consent record.
 */
export const CONSENT_VERSION = "draft-2026-10-22";

export const CONSENT_IS_DRAFT = true;

export const consentCopy = {
  label: "I agree to how my information is used",
  summary:
    "We keep only what we need to run your account: your email address, your sign-in details, and the plans you save. Vendors you contact will see the details you choose to share with them. You can delete your account and data at any time from Account settings.",
  draftNotice: "DRAFT wording. To be reviewed before launch.",
};

/** Shown on estimates when a vendor does not charge GST or service charge. Vendors can edit their own. */
export const defaultTaxNotes = {
  noGstNote: "Prices not subject to GST",
  noServiceChargeNote: "No service charge",
};
