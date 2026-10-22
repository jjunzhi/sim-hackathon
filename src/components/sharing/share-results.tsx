"use client";

import { motion } from "motion/react";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { watchVotes } from "@/lib/data/shares";
import type { WithId } from "@/lib/data/venues";
import { useT } from "@/lib/i18n/provider";
import { themeLabelT } from "@/lib/render/themes";
import { computeResults, type ShareOption, type Vote } from "@/lib/sharing/model";
import { transition } from "@/lib/motion";

export const optionLetter = (i: number) => String.fromCharCode(65 + i);
type T = ReturnType<typeof useT>;
/** "Option A: Venue, Theme" in the reader's language (pass `t` from useT()). */
export const optionLabel = (t: T, o: ShareOption, i: number) => t("sharing.optionLabel", { letter: optionLetter(i), venue: o.venueName, theme: themeLabelT(t, o.themeId) });

/** Each option's share of real votes, plus notes. Only the couple sees this. */
export function ShareResults({ shareId, options }: { shareId: string; options: ShareOption[] }) {
  const t = useT();
  const [votes, setVotes] = useState<WithId<Vote>[] | null>(null);
  useEffect(() => watchVotes(shareId, setVotes), [shareId]);
  if (!votes) return <p className="text-small text-muted">{t("sharing.loadingVotes")}</p>;

  const r = computeResults(votes, options.length);
  const [a, b, c] = r.leaders.map((i) => t("sharing.option", { letter: optionLetter(i) }));
  const summary =
    r.summary === "none"
      ? t("sharing.noVotes")
      : r.summary === "agree"
        ? t("sharing.agree", { option: optionLabel(t, options[r.leaders[0]!]!, r.leaders[0]!) })
        : r.leaders.length > 2
          ? t("sharing.splitBetweenThree", { a: a!, b: b!, c: c! })
          : r.leaders.length > 1
            ? t("sharing.splitBetweenTwo", { a: a!, b: b! })
            : t("sharing.splitAhead", { letter: optionLetter(r.leaders[0]!) });

  return (
    <div className="flex flex-col gap-4">
      <p className="font-semibold" aria-live="polite">
        {summary} <span className="num font-normal text-muted">{t("sharing.votes", { count: r.total })}</span>
      </p>
      <ul className="flex flex-col gap-3">
        {r.options.map((o) => (
          <li key={o.index} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-small">
              <span>{optionLabel(t, options[o.index]!, o.index)}</span>
              <span className="num font-semibold">{t("sharing.pctCount", { pct: o.pct, votes: o.count })}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-subtle" role="presentation">
              <motion.div className="h-full origin-left rounded-full bg-accent" initial={{ scaleX: 0 }} animate={{ scaleX: o.pct / 100 }} transition={transition.move} />
            </div>
          </li>
        ))}
      </ul>
      {votes.some((v) => v.note || v.name) && (
        <section aria-label={t("sharing.notesAria")} className="flex flex-col gap-2">
          <h4 className="flex items-center gap-2 text-small font-semibold">
            <MessageCircle aria-hidden className="size-4 text-gold" /> {t("sharing.notes")}
          </h4>
          <ul className="flex flex-col gap-2">
            {votes
              .filter((v) => v.note || v.name)
              .map((v) => (
                <li key={v.id} className="rounded-lg bg-subtle px-3 py-2 text-small">
                  {v.name
                    ? t(v.note ? "sharing.choseWithNote" : "sharing.chose", { name: v.name, letter: optionLetter(v.optionIndex), note: v.note })
                    : t(v.note ? "sharing.someoneChoseWithNote" : "sharing.someoneChose", { letter: optionLetter(v.optionIndex), note: v.note })}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
