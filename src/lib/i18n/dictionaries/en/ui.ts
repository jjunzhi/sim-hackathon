/** UI primitives, the app header and the auth shell. Shared wording (Close, Dismiss, Step x of y, nav.*) lives in common.ts. */
export const ui = {
  // ToastProvider
  "ui.toast.region": "Notification",

  // SkeletonList
  "ui.skeleton.loading": "Loading",

  // BeforeAfterSlider
  "ui.compare.before": "Before",
  "ui.compare.after": "After",
  "ui.compare.label": "Compare {before} and {after}",
  "ui.compare.valueText": "{percent}% {after} showing",

  // JourneyStepper
  "ui.stepper.label": "Planning steps",
  "ui.stepper.completed": "(completed)",

  // AppHeader
  "ui.header.forVendors": "for vendors",
  "ui.header.vendorHome": "Vendor home",

  // AuthShell
  "ui.authShell.notConfigured": "Firebase is not configured",
  "ui.authShell.needsSettings": "Sign-in and saving need Firebase settings in {file}. Nothing has been saved and the app will not work without them.",
  "ui.authShell.seeReadme": "See README, section \"Firebase setup\", then restart the dev server.",
  "ui.authShell.loadingAccount": "Loading your account",

  // AuthLayout Divider
  "ui.divider.or": "or",

  // RequireAuth
  "ui.requireAuth.areaForVendors": "This area is for vendors",
  "ui.requireAuth.areaForCouples": "This area is for couples",
  "ui.requireAuth.createdAsVendor": "Your account was created as a vendor account. Account types can't be changed, so please use a separate account for this.",
  "ui.requireAuth.createdAsCouple": "Your account was created as a couple account. Account types can't be changed, so please use a separate account for this.",
  "ui.requireAuth.goToAccount": "Go to your account",
} as const;
