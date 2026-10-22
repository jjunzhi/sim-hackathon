/**
 * A one-event iCalendar file (RFC 5545) for "Add to calendar". All-day event,
 * so no time zone is involved. Required VEVENT properties: UID, DTSTAMP,
 * DTSTART. Lines are CRLF-terminated and folded at 75 octets.
 */
export interface IcsEvent {
  /** Stable per plan so re-importing updates rather than duplicates. */
  uid: string;
  /** YYYY-MM-DD */
  date: string;
  summary: string;
  location?: string;
  description?: string;
  url?: string;
  /** Injected for tests; defaults to now. */
  now?: Date;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** The next calendar day, for the exclusive DTEND of an all-day event. */
export function nextDay(date: string): string {
  const m = DATE_RE.exec(date)!;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return d.toISOString().slice(0, 10);
}

/** RFC 5545 3.3.11: escape backslash, semicolon, comma and newlines in TEXT values. */
export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 3.1: fold at 75 octets (not characters), continuation lines start with a space. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines carry a leading space
    if (bytes + n > limit) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += n;
  }
  out.push(current);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join("\r\n");
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildIcs(ev: IcsEvent): string {
  if (!isIsoDate(ev.date)) throw new Error("date must be YYYY-MM-DD");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WeddingVista//Plan//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${stamp(ev.now ?? new Date())}`,
    `DTSTART;VALUE=DATE:${ev.date.replace(/-/g, "")}`,
    `DTEND;VALUE=DATE:${nextDay(ev.date).replace(/-/g, "")}`,
    `SUMMARY:${escapeText(ev.summary)}`,
    ...(ev.location ? [`LOCATION:${escapeText(ev.location)}`] : []),
    ...(ev.description ? [`DESCRIPTION:${escapeText(ev.description)}`] : []),
    ...(ev.url ? [`URL:${ev.url}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** A browser download of the file, named after the plan. */
export function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
