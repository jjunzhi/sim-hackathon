"use client";

import { motion } from "motion/react";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { watchVotes } from "@/lib/data/shares";
import type { WithId } from "@/lib/data/venues";
import { themeLabel } from "@/lib/render/themes";
import { computeResults, type ShareOption, type Vote } from "@/lib/sharing/model";
import { transition } from "@/lib/motion";

export const optionLetter = (i: number) => String.fromCharCode(65 + i);
export const optionLabel = (o: ShareOption, i: number) => `Option ${optionLetter(i)}: ${o.venueName}, ${themeLabel(o.themeId)}`;

/** Each option's share of real votes, plus notes. Only the couple sees this. */
export function ShareResults({ shareId, options }: { shareId: string; options: ShareOption[] }) {
  const [votes, setVotes] = useState<WithId<Vote>[] | null>(null);
  useEffect(() => watchVotes(shareId, setVotes), [shareId]);
  if (!votes) return <p className="text-small text-muted">Loading votes...</p>;

  const r = computeResults(votes, options.length);
  const summary =
    r.summary === "none"
      ? "No votes yet. Share the link with family."
      : r.summary === "agree"
        ? `Most of your family agree: ${optionLabel(options[r.leaders[0]!]!, r.leaders[0]!)}.`
        : r.leaders.length > 1
          ? `Opinions are split between ${r.leaders.map((i) => `Option ${optionLetter(i)}`).join(" and ")}.`
          : `Opinions are split. Option ${optionLetter(r.leaders[0]!)} is ahead.`;

  return (
    <div className="flex flex-col gap-4">
      <p className="font-semibold" aria-live="polite">
        {summary} <span className="num font-normal text-muted">({r.total} {r.total === 1 ? "vote" : "votes"})</span>
      </p>
      <ul className="flex flex-col gap-3">
        {r.options.map((o) => (
          <li key={o.index} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-small">
              <span>{optionLabel(options[o.index]!, o.index)}</span>
              <span className="num font-semibold">
                {o.pct}% · {o.count}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-subtle" role="presentation">
              <motion.div className="h-full origin-left rounded-full bg-accent" initial={{ scaleX: 0 }} animate={{ scaleX: o.pct / 100 }} transition={transition.move} />
            </div>
          </li>
        ))}
      </ul>
      {votes.some((v) => v.note || v.name) && (
        <section aria-label="Notes from family" className="flex flex-col gap-2">
          <h4 className="flex items-center gap-2 text-small font-semibold">
            <MessageCircle aria-hidden className="size-4 text-gold" /> Notes
          </h4>
          <ul className="flex flex-col gap-2">
            {votes
              .filter((v) => v.note || v.name)
              .map((v) => (
                <li key={v.id} className="rounded-lg bg-subtle px-3 py-2 text-small">
                  <span className="font-semibold">{v.name || "Someone"}</span> chose Option {optionLetter(v.optionIndex)}
                  {v.note ? `: "${v.note}"` : ""}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
