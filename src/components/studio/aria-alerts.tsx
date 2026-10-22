"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AriaAlert } from "@/lib/assistant/alerts";
import type { TKey } from "@/lib/i18n/dictionaries/types";
import { useT } from "@/lib/i18n/provider";
import { formatSGD } from "@/lib/money";

/** The message sent to Aria when the couple asks about an alert. */
export const ALERT_PROMPT_KEYS = {
  overBudget: "assistant.alert.askOverBudget",
  overCapacity: "assistant.alert.askOverCapacity",
  dateUnavailable: "assistant.alert.askDate",
} as const satisfies Record<AriaAlert["kind"], TKey>;

/**
 * What Aria noticed. Describing only: nothing in the plan changes from here.
 * In Aria's chat each alert has its own "Ask Aria for options"; in the Studio
 * (`openLabel`) one button opens Aria for all of them.
 */
export function AriaAlerts({ alerts, onAsk, openLabel }: { alerts: AriaAlert[]; onAsk: (a: AriaAlert) => void; openLabel?: string }) {
  const t = useT();
  if (!alerts.length) return null;
  const text = (a: AriaAlert) => {
    switch (a.kind) {
      case "overBudget":
        return t("assistant.alert.overBudget", { amount: formatSGD(a.overCents) });
      case "overCapacity":
        return a.source === "guests" ? t("assistant.alert.overCapacityGuests", { count: a.over }) : t("assistant.alert.overCapacityPlan", { count: a.over });
      case "dateUnavailable":
        return t("assistant.alert.dateUnavailable", { vendors: a.vendors.join(", ") });
    }
  };
  return (
    <section aria-label={t("assistant.alert.title")} className="flex flex-col gap-2 rounded-xl border border-warning bg-surface p-3">
      <p className="flex items-center gap-2 text-small font-semibold">
        <TriangleAlert aria-hidden className="size-4 shrink-0 text-warning-icon" />
        {t("assistant.alert.title")}
      </p>
      <ul className="flex flex-col gap-2">
        {alerts.map((a) => (
          <li key={a.kind} className="flex flex-wrap items-center justify-between gap-2">
            <span className="num text-small">{text(a)}</span>
            {!openLabel && (
              <Button variant="ghost" onClick={() => onAsk(a)}>
                {t("assistant.alert.ask")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {openLabel && (
        <Button className="self-start" onClick={() => onAsk(alerts[0]!)}>
          {openLabel}
        </Button>
      )}
    </section>
  );
}
