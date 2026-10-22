"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChipGroup } from "@/components/ui/chip-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isIsoDate } from "@/lib/calendar/ics";
import { useT } from "@/lib/i18n/provider";
import type { PlanDraft } from "@/lib/plans/model";
import { DIET_KEYS, DIET_TAGS } from "@/lib/venues/inclusion";
import { CULTURE_TAGS } from "@/lib/venues/model";
import { tagLabel } from "@/lib/venues/tag-labels";
import { BRIEF_LIMITS, EMPTY_BRIEF } from "../../../functions/src/assistant/types";

export const BRIEF_FORM_ID = "aria-brief";

/** Whole dollars from the budget field; null when empty; undefined when not a valid amount. */
export function parseBudget(v: string): number | null | undefined {
  const s = v.replace(/[,\s$]/g, "");
  if (!s) return null;
  if (!/^\d+$/.test(s)) return undefined;
  const cents = Number(s) * 100;
  return cents >= 100 && cents <= BRIEF_LIMITS.budgetMaxCents ? cents : undefined;
}

/**
 * The couple's planning brief: guests, date and budget on the plan, plus
 * style, traditions, food and access needs, and notes. The Save button sits in
 * the dialog footer and submits this form by id.
 */
export function AriaBrief({ plan, onSave, onPlanFromBrief }: { plan: PlanDraft; onSave: (next: PlanDraft) => void; onPlanFromBrief: (next: PlanDraft) => void }) {
  const t = useT();
  const start = plan.brief ?? EMPTY_BRIEF;
  const [budget, setBudget] = useState(plan.budgetCents ? String(plan.budgetCents / 100) : "");
  const [guests, setGuests] = useState(String(plan.headcount));
  const [date, setDate] = useState(plan.weddingDate ?? "");
  const [style, setStyle] = useState(start.style);
  const [traditions, setTraditions] = useState<string[]>(start.traditions);
  const [diet, setDiet] = useState<string[]>(start.dietaryTags);
  const [stepFree, setStepFree] = useState(start.stepFree);
  const [notes, setNotes] = useState(start.notes);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  function build(): PlanDraft | null {
    const cents = parseBudget(budget);
    if (cents === undefined) {
      setBudgetError(t("assistant.brief.invalidBudget"));
      return null;
    }
    setBudgetError(null);
    const n = Number(guests);
    return {
      ...plan,
      budgetCents: cents,
      headcount: Number.isInteger(n) && n >= 1 && n <= 7000 ? n : plan.headcount,
      weddingDate: isIsoDate(date) ? date : null,
      brief: { style: style.trim(), traditions, dietaryTags: diet, stepFree, notes: notes.trim() },
    };
  }

  return (
    <form
      id={BRIEF_FORM_ID}
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const next = build();
        if (next) onSave(next);
      }}
    >
      <p className="text-muted">{t("assistant.brief.intro")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("assistant.brief.budget")} prefix="S$" inputMode="numeric" value={budget}
          onChange={(e) => {
            setBudget(e.target.value);
            setBudgetError(null);
          }} hint={t("assistant.brief.budgetHint")} error={budgetError ?? undefined} />
        <Input label={t("assistant.brief.guests")} type="number" min={1} max={7000} value={guests} onChange={(e) => setGuests(e.target.value)} />
        <Input label={t("date.label")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label={t("assistant.brief.style")} placeholder={t("assistant.brief.stylePlaceholder")} maxLength={BRIEF_LIMITS.styleMax} value={style} onChange={(e) => setStyle(e.target.value)} />
      </div>
      <ChipGroup legend={t("assistant.brief.traditions")} options={CULTURE_TAGS} value={traditions} onChange={setTraditions} label={(o) => tagLabel(t, o)} />
      <ChipGroup legend={t("assistant.brief.diet")} options={DIET_TAGS} value={diet} onChange={setDiet} label={(o) => t(DIET_KEYS[o as keyof typeof DIET_KEYS])} />
      <Checkbox label={t("assistant.brief.stepFree")} checked={stepFree} onCheckedChange={setStepFree} />
      <Textarea label={t("assistant.brief.notes")} hint={t("assistant.brief.notesHint")} maxLength={BRIEF_LIMITS.notesMax} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button
        className="self-start"
        onClick={() => {
          const next = build();
          if (next) onPlanFromBrief(next);
        }}
      >
        {t("assistant.brief.planFromBrief")}
      </Button>
    </form>
  );
}
