import type { TKey } from "@/lib/i18n/dictionaries/types";
import type { Vars } from "@/lib/i18n/format";

/** The `t` function from useT(), so messages come out in the reader's language. */
export type Translate = (key: TKey, vars?: Vars) => string;

/** Plain-language messages for Firebase Auth error codes. null = stay silent. */
export function authErrorMessage(err: unknown, t: Translate): string | null {
  const code = (err as { code?: string } | null)?.code ?? "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    case "auth/email-already-in-use":
      return t("auth.error.emailInUse");
    case "auth/invalid-email":
      return t("auth.error.invalidEmail");
    case "auth/weak-password":
      return t("auth.error.weakPassword");
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return t("auth.error.badCredentials");
    case "auth/too-many-requests":
      return t("auth.error.tooMany");
    case "auth/network-request-failed":
      return t("auth.error.network");
    case "auth/popup-blocked":
      return t("auth.error.popupBlocked");
    case "auth/account-exists-with-different-credential":
      return t("auth.error.differentCredential");
    default:
      return t("error.generic");
  }
}

/** Only allow same-site relative paths as a post-sign-in destination. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
