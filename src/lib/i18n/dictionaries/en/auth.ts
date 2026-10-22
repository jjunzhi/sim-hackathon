/** Sign in, sign up, welcome, account and the Firebase Auth error messages. "Sign in" / "Account" reuse nav.* from common.ts. */
export const auth = {
  // Shared fields
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.continueWithGoogle": "Continue with Google",
  "auth.orUseEmail": "or use email",

  // SignIn
  "auth.signIn.title": "Welcome back",
  "auth.signIn.newHere": "New here?",
  "auth.signIn.createAccount": "Create an account",
  "auth.signIn.forgot": "Forgot your password?",
  "auth.signIn.enterEmailFirst": "Enter your email address above first.",
  "auth.signIn.resetSent": "If an account uses that email, we've sent a link to reset the password.",

  // SignUp
  "auth.signUp.title": "Create your account",
  "auth.signUp.intro": "Start planning, or list your venue.",
  "auth.signUp.haveAccount": "Already have an account?",
  "auth.signUp.chooseRole": "Choose how you'll use WeddingVista.",
  "auth.signUp.agreeFirst": "Please agree before creating your account.",
  "auth.signUp.passwordShort": "Use at least 8 characters.",
  "auth.signUp.passwordHint": "At least 8 characters.",
  "auth.signUp.submit": "Create account",

  // Welcome
  "auth.welcome.title": "One last step",
  "auth.welcome.signedInAs": "Signed in as {email}.",
  "auth.welcome.yourAccount": "your account",
  "auth.welcome.agreeFirst": "Please agree before continuing.",
  "auth.welcome.continue": "Continue",
  "auth.welcome.differentAccount": "Use a different account",

  // RolePicker
  "auth.role.legend": "How will you use WeddingVista?",
  "auth.role.hint": "This can't be changed later.",
  "auth.role.coupleTitle": "We're planning a wedding",
  "auth.role.coupleBody": "Compare venues, see decorated rooms and share options with family.",
  "auth.role.vendorTitle": "I'm a vendor",
  "auth.role.vendorBody": "List your venue, spaces and prices, and receive enquiries.",

  // ConsentField (wording version: CONSENT_VERSION in src/lib/legal.ts)
  "auth.consent.label": "I agree to how my information is used",
  "auth.consent.summary":
    "We keep only what we need to run your account: your email address, your sign-in details, and the plans you save. Vendors you contact will see the details you choose to share with them. You can delete your account and data at any time from Account settings.",
  "auth.consent.draftNotice": "DRAFT wording. To be reviewed before launch.",

  // Account
  "auth.account.yourDetails": "Your details",
  "auth.account.type": "Account type",
  "auth.account.vendor": "Vendor",
  "auth.account.couple": "Couple",
  "auth.account.signedInWith": "Signed in with",
  "auth.account.google": "Google",
  "auth.account.emailPassword": "Email and password",
  "auth.account.deleteTitle": "Delete your account",
  "auth.account.deleteBodyVendor": "This permanently removes your account, your venues, spaces, prices and photos. Couples will no longer see your listings.",
  "auth.account.deleteBodyCouple": "This permanently removes your account and everything you've saved.",
  "auth.account.cantUndo": "It can't be undone.",
  "auth.account.deleteButton": "Delete account",
  "auth.account.deleteConfirmTitle": "Delete your account?",
  "auth.account.enterPassword": "Enter your password to confirm.",
  "auth.account.confirmGoogle": "Confirm with Google to continue.",
  "auth.account.keep": "Keep my account",
  "auth.account.deletePermanently": "Delete permanently",
  "auth.account.deleteFailed": "We couldn't delete everything just now. Nothing has been lost; please try again.",

  // authErrorMessage (src/lib/auth/errors.ts); the fallback reuses error.generic
  "auth.error.emailInUse": "An account with this email already exists. Try signing in instead.",
  "auth.error.invalidEmail": "Enter an email address like name@example.com.",
  "auth.error.weakPassword": "Choose a password with at least 8 characters.",
  "auth.error.badCredentials": "That email and password don't match. Check them and try again.",
  "auth.error.tooMany": "Too many attempts. Please wait a few minutes and try again.",
  "auth.error.network": "We couldn't reach the server. Check your connection and try again.",
  "auth.error.popupBlocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth.error.differentCredential": "This email already uses a different sign-in method. Sign in with email and password instead.",
} as const;
