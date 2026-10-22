"use client";

import { CalendarX, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { isIsoDate } from "@/lib/calendar/ics";
import { addBlockedDate, removeBlockedDate, watchBlockedDates, type BlockedDate } from "@/lib/data/vendors";
import type { WithId } from "@/lib/data/venues";
import { formatDate } from "@/lib/i18n/format";

const MAX_DATES = 200;

/**
 * Dates the vendor already has booked, entered by hand. Couples see them on
 * the venue page and get a warning if they pick one. Only the date is public;
 * the note stays short and should never name a client.
 */
export function BlockedDates({ uid }: { uid: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<WithId<BlockedDate>[] | null>(null);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => watchBlockedDates(uid, setRows, () => setRows([])), [uid]);

  async function add(ev: React.FormEvent) {
    ev.preventDefault();
    if (!isIsoDate(date)) return setError("Choose a date.");
    if (rows?.some((r) => r.date === date)) return setError("That date is already listed.");
    if ((rows?.length ?? 0) >= MAX_DATES) return setError(`You can list up to ${MAX_DATES} dates. Remove past ones first.`);
    setError(null);
    setBusy(true);
    try {
      await addBlockedDate(uid, { date, note: note.trim().slice(0, 80) });
      setDate("");
      setNote("");
    } catch {
      toast({ title: "We couldn't add that date. Please try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} noValidate className="flex flex-wrap items-end gap-3">
        <Input label="Booked date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={error ?? undefined} className="md:max-w-xs" />
        <Input
          label="Note for yourself (optional)"
          hint="Couples see only the date. Don't put client names here."
          maxLength={80}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-w-0 flex-1"
        />
        <Button type="submit" loading={busy} icon={<CalendarX aria-hidden className="size-4" />}>
          Add date
        </Button>
      </form>
      {rows && rows.length === 0 && <p className="text-small text-muted">No dates listed yet.</p>}
      {rows && rows.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span className="num">
                {formatDate("en-SG", new Date(`${r.date}T12:00:00+08:00`).getTime(), { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                {r.note && <span className="text-small text-muted"> · {r.note}</span>}
              </span>
              <button
                type="button"
                aria-label={`Remove ${r.date}`}
                onClick={() => removeBlockedDate(uid, r.id).catch(() => toast({ title: "We couldn't remove that date.", tone: "error" }))}
                className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:text-ink"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
