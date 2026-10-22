"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/provider";
import type { PlanDraft, TimelineEntry } from "@/lib/plans/model";
import { BRIEF_LIMITS } from "../../../functions/src/assistant/types";

export const TIMELINE_FORM_ID = "aria-timeline";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Rows the couple filled in, checked and in time order; null if a started row is incomplete. */
export function cleanRows(rows: TimelineEntry[]): TimelineEntry[] | null {
  const filled = rows.map((r) => ({ time: r.time.trim(), label: r.label.trim() })).filter((r) => r.time || r.label);
  if (filled.some((r) => !HHMM.test(r.time) || !r.label || r.label.length > BRIEF_LIMITS.timelineLabelMax)) return null;
  return filled.sort((a, b) => a.time.localeCompare(b.time)).slice(0, BRIEF_LIMITS.timelineEntries);
}

/** The day-of timeline, a DRAFT the couple edits. Save sits in the dialog footer and submits by id. */
export function AriaTimeline({ plan, onSave, onAsk }: { plan: PlanDraft; onSave: (next: PlanDraft) => void; onAsk: () => void }) {
  const t = useT();
  const [rows, setRows] = useState<TimelineEntry[]>(() => (plan.timeline?.length ? plan.timeline.map((e) => ({ ...e })) : []));
  const [error, setError] = useState<string | null>(null);
  const full = rows.length >= BRIEF_LIMITS.timelineEntries;
  const set = (i: number, patch: Partial<TimelineEntry>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <form
      id={TIMELINE_FORM_ID}
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const clean = cleanRows(rows);
        if (!clean) return setError(t("assistant.timeline.invalid"));
        setError(null);
        setRows(clean);
        onSave({ ...plan, timeline: clean });
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-h3">{t("assistant.timeline.title")}</h3>
        <Badge tone="sample">{t("assistant.timeline.draft")}</Badge>
      </div>
      <p className="text-muted">{t("assistant.timeline.intro")}</p>
      {rows.length === 0 && <p className="text-small text-muted">{t("assistant.timeline.empty")}</p>}
      <ol className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={i} className="flex items-end gap-2">
            <Input label={t("assistant.timeline.time")} type="time" className="w-[9.5rem] shrink-0" value={r.time} onChange={(e) => set(i, { time: e.target.value })} />
            <Input label={t("assistant.timeline.label")} className="min-w-0 flex-1" maxLength={BRIEF_LIMITS.timelineLabelMax} value={r.label} onChange={(e) => set(i, { label: e.target.value })} />
            <Button
              variant="ghost"
              aria-label={t("assistant.timeline.remove", { time: r.time || "--:--" })}
              onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
              icon={<Trash2 aria-hidden className="size-4" />}
            />
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="text-small text-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setRows((r) => [...r, { time: "", label: "" }])} disabled={full} icon={<Plus aria-hidden className="size-4" />}>
          {t("assistant.timeline.add")}
        </Button>
        <Button variant="ghost" onClick={onAsk}>
          {t("assistant.timeline.ask")}
        </Button>
      </div>
      {full && <p className="text-small text-muted">{t("assistant.timeline.full", { max: BRIEF_LIMITS.timelineEntries })}</p>}
    </form>
  );
}
