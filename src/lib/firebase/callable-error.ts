/**
 * The Functions SDK reports a callable's HttpsError as { code: "functions/<code>",
 * message: "<server message> [<http status>]" }. These read it without the
 * SDK's decoration, so the server's message can be matched or shown as written.
 */
export function callableCode(err: unknown): string {
  return ((err as { code?: string }).code ?? "").replace(/^functions\//, "");
}

export function callableMessage(err: unknown): string {
  return ((err as { message?: string }).message ?? "").replace(/\s*\[\d{3}\]$/, "");
}
