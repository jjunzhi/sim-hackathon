"use client";

import { useEffect, useState } from "react";
import { SkeletonList } from "@/components/ui/skeleton";
import { watchDecisions, type Decision } from "@/lib/data/decisions";
import type { WithId } from "@/lib/data/venues";
import { useLocale } from "@/lib/i18n/provider";
import { formatSGD } from "@/lib/money";

const ACTION_KEYS = {
  applied: "assistant.decisions.applied",
  adjusted: "assistant.decisions.adjusted",
  declined: "assistant.decisions.declined",
  alternatives: "assistant.decisions.alternatives",
} as const;

/** The plan's decision log, newest first. Read-only. */
export function AriaDecisions({ planId }: { planId: string }) {
  const { t, date } = useLocale();
  const [rows, setRows] = useState<WithId<Decision>[] | null>(null);
  useEffect(() => watchDecisions(planId, setRows, () => setRows([])), [planId]);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-h3">{t("assistant.decisions.title")}</h3>
      <p className="text-muted">{t("assistant.decisions.intro")}</p>
      {rows === null ? (
        <SkeletonList rows={2} label={t("assistant.decisions.title")} />
      ) : rows.length === 0 ? (
        <p className="text-small text-muted">{t("assistant.decisions.empty")}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((d) => (
            <li key={d.id} className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3">
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{t(ACTION_KEYS[d.action])}</span>
                {d.createdAt && <span className="num text-small text-muted">{date(d.createdAt.toDate().getTime(), { dateStyle: "medium", timeStyle: "short" })}</span>}
              </p>
              {d.summary && <p className="text-small">{d.summary}</p>}
              {d.changes.length > 0 && (
                <ul className="list-disc pl-5 text-small text-muted">
                  {d.changes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              )}
              {d.beforeCents !== null && d.afterCents !== null && d.beforeCents !== d.afterCents && (
                <p className="num text-small text-muted">{t("assistant.costChange", { from: formatSGD(d.beforeCents), to: formatSGD(d.afterCents) })}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
