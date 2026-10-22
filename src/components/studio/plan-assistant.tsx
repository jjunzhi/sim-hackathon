"use client";

import { Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { applyProposal, askAssistant, nameOfKey, type Change, type ChatMessage } from "@/lib/assistant/client";
import { useLocale } from "@/lib/i18n/provider";
import { formatSGD } from "@/lib/money";
import { buildPlanEstimates, type VendorCatalog } from "@/lib/plans/estimates";
import type { PlanDraft } from "@/lib/plans/model";
import { themeLabelT } from "@/lib/render/themes";
import type { CatalogVenue } from "@/lib/venues/catalog";
import type { Space } from "@/lib/venues/model";

type SpaceRow = Space & { id: string };
const TIER_KEYS = { peak: "studio.tierPeak", offPeak: "studio.tierOffPeak", standard: "assistant.tierStandard" } as const;

/**
 * The planning assistant. A chat that suggests checked changes to this plan;
 * each suggestion shows what changes and its effect on the estimate, and
 * nothing changes until the couple taps Apply. Kept only in this page:
 * the conversation is never stored.
 */
export function PlanAssistant({
  open,
  onOpenChange,
  venue,
  spaces,
  catalogs,
  plan,
  canUse,
  onSave,
  onApply,
  messages,
  setMessages,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  venue: CatalogVenue;
  spaces: SpaceRow[];
  catalogs: VendorCatalog[];
  plan: PlanDraft;
  /** A saved plan of a signed-in couple. */
  canUse: boolean;
  onSave: () => void;
  onApply: (next: PlanDraft) => void;
  messages: ChatMessage[];
  setMessages: (update: (prev: ChatMessage[]) => ChatMessage[]) => void;
}) {
  const { t, locale, date } = useLocale();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  const estimateOf = useMemo(
    () => (p: PlanDraft) => {
      const space = spaces.find((s) => s.id === p.spaceId) ?? null;
      return buildPlanEstimates({ plan: p, venueOwnerUid: venue.ownerUid, space, catalogs }).combinedTotalCents;
    },
    [spaces, venue.ownerUid, catalogs],
  );

  async function send(ev?: React.FormEvent) {
    ev?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const history: ChatMessage[] = [...messages, { role: "user", text }];
    setMessages(() => history);
    setDraft("");
    setBusy(true);
    setError(null);
    const r = await askAssistant({ venueId: venue.id, plan, history, locale, estimateTotalCents: estimateOf(plan) });
    setBusy(false);
    if (!r.ok) {
      setError(r.error.kind === "limit" ? r.error.message : t("assistant.failed"));
      return;
    }
    setRemaining(r.remainingToday);
    setMessages((prev) => [...prev, { role: "model", text: r.reply, proposal: r.proposal, demo: r.demo }]);
  }

  function settle(index: number, how: "applied" | "dismissed") {
    const m = messages[index];
    if (how === "applied" && m?.proposal) onApply(applyProposal(plan, m.proposal.changes, catalogs));
    setMessages((prev) => prev.map((x, i) => (i === index ? { ...x, settled: how } : x)));
  }

  const describe = (c: Change): string => {
    switch (c.kind) {
      case "headcount":
        return t("assistant.change.headcount", { from: plan.headcount, to: c.value });
      case "space":
        return t("assistant.change.space", { room: spaces.find((s) => s.id === c.spaceId)?.name ?? c.spaceId });
      case "tier":
        return t("assistant.change.tier", { tier: t(TIER_KEYS[c.tierKey]) });
      case "theme":
        return t("assistant.change.theme", { theme: themeLabelT(t, c.themeId) });
      case "date":
        return c.value ? t("assistant.change.date", { date: date(new Date(`${c.value}T12:00:00+08:00`).getTime(), { dateStyle: "long" }) }) : t("assistant.change.dateClear");
      case "add":
        return c.quantity > 1 ? t("assistant.change.addQty", { item: nameOfKey(c.key, catalogs), count: c.quantity }) : t("assistant.change.add", { item: nameOfKey(c.key, catalogs) });
      case "remove":
        return t("assistant.change.remove", { item: nameOfKey(c.key, catalogs) });
    }
  };

  const showDemo = messages.some((m) => m.demo);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("assistant.title")}
      description={t("assistant.description")}
      className="sm:max-w-2xl"
      footer={
        canUse ? (
          <form onSubmit={send} className="flex w-full flex-col gap-2">
            <div className="flex items-end gap-2">
              <Textarea
                label={t("assistant.inputLabel")}
                placeholder={t("assistant.placeholder")}
                value={draft}
                maxLength={2000}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                className="min-w-0 flex-1 [&_textarea]:min-h-14"
              />
              <Button type="submit" variant="primary" loading={busy} disabled={!draft.trim()} icon={<Send aria-hidden className="size-4" />}>
                {t("assistant.send")}
              </Button>
            </div>
            <p className="text-small text-muted">
              {t("assistant.note")}
              {remaining !== null && <span className="num"> {t("assistant.remaining", { count: remaining })}</span>}
            </p>
          </form>
        ) : (
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <p className="text-small text-muted">{t("assistant.saveFirst")}</p>
            <Button variant="primary" onClick={onSave}>
              {t("assistant.saveCta")}
            </Button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {showDemo && (
          <Badge tone="sample" className="self-start">
            {t("assistant.demo")}
          </Badge>
        )}
        <div ref={listRef} role="log" aria-live="polite" aria-label={t("assistant.title")} className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-1">
          <Bubble role="model" label={t("assistant.ai")}>
            {t("assistant.intro")}
          </Bubble>
          {messages.map((m, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Bubble role={m.role} label={m.role === "user" ? t("assistant.you") : t("assistant.ai")}>
                {m.text}
              </Bubble>
              {m.proposal && m.proposal.changes.length > 0 && (
                <div className="ml-0 flex flex-col gap-2 rounded-xl border border-accent bg-surface p-3 sm:ml-8">
                  <p className="text-small font-semibold">{t("assistant.suggestion")}</p>
                  <ul className="flex list-disc flex-col gap-0.5 pl-5 text-small">
                    {m.proposal.changes.map((c, j) => (
                      <li key={j}>{describe(c)}</li>
                    ))}
                  </ul>
                  {(() => {
                    const before = estimateOf(plan);
                    const after = estimateOf(applyProposal(plan, m.proposal!.changes, catalogs));
                    return (
                      <p className="num text-small text-muted">
                        {before === after ? t("assistant.costSame", { total: formatSGD(before) }) : t("assistant.costChange", { from: formatSGD(before), to: formatSGD(after) })}{" "}
                        <Badge tone="estimate">{t("badge.estimate")}</Badge>
                      </p>
                    );
                  })()}
                  {m.settled ? (
                    <p role="status" className="text-small font-semibold">
                      {m.settled === "applied" ? t("assistant.applied") : t("assistant.dismissed")}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => settle(i, "applied")} icon={<Sparkles aria-hidden className="size-4" />}>
                        {t("assistant.apply")}
                      </Button>
                      <Button variant="ghost" onClick={() => settle(i, "dismissed")}>
                        {t("assistant.dismiss")}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {busy && <p className="text-small text-muted">{t("assistant.thinking")}</p>}
        </div>
        {error && (
          <p role="alert" className="text-small text-error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function Bubble({ role, label, children }: { role: "user" | "model"; label: string; children: React.ReactNode }) {
  return (
    <div className={role === "user" ? "flex flex-col items-end" : "flex flex-col items-start"}>
      <span className="sr-only">{label}:</span>
      <p
        className={
          role === "user"
            ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-accent-tint px-4 py-2.5 text-ink"
            : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-2.5"
        }
      >
        {children}
      </p>
    </div>
  );
}
