/** Plain-language messages for Firebase Auth error codes. null = stay silent. */
export function authErrorMessage(err: unknown): string | null {
  const code = (err as { code?: string } | null)?.code ?? "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/invalid-email":
      return "Enter an email address like name@example.com.";
    case "auth/weak-password":
      return "Choose a password with at least 8 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match. Check them and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "We couldn't reach the server. Check your connection and try again.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google window. Allow pop-ups for this site and try again.";
    case "auth/account-exists-with-different-credential":
      return "This email already uses a different sign-in method. Sign in with email and password instead.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/** Only allow same-site relative paths as a post-sign-in destination. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
