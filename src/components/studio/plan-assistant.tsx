"use client";

import Link from "next/link";
import { ArrowRight, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { AriaAlert } from "@/lib/assistant/alerts";
import { adjustChanges, applyProposal, askAssistant, editableNumber, nameOfKey, type Change, type ChatMessage, type Proposal, type Settled } from "@/lib/assistant/client";
import { cn } from "@/lib/cn";
import { logDecision } from "@/lib/data/decisions";
import { useLocale } from "@/lib/i18n/provider";
import { formatSGD } from "@/lib/money";
import { buildPlanEstimates, type VendorCatalog } from "@/lib/plans/estimates";
import type { PlanDraft } from "@/lib/plans/model";
import { themeLabelT } from "@/lib/render/themes";
import type { CatalogVenue } from "@/lib/venues/catalog";
import type { Space } from "@/lib/venues/model";
import { ALERT_PROMPT_KEYS, AriaAlerts } from "./aria-alerts";
import { AriaBrief, BRIEF_FORM_ID } from "./aria-brief";
import { AriaDecisions } from "./aria-decisions";
import { AriaTimeline, TIMELINE_FORM_ID } from "./aria-timeline";

type SpaceRow = Space & { id: string };
const TIER_KEYS = { peak: "studio.tierPeak", offPeak: "studio.tierOffPeak", standard: "assistant.tierStandard" } as const;
const TABS = ["chat", "brief", "timeline", "decisions"] as const;
type Tab = (typeof TABS)[number];
const TAB_KEYS = { chat: "assistant.tab.chat", brief: "assistant.tab.brief", timeline: "assistant.tab.timeline", decisions: "assistant.tab.decisions" } as const;
const SETTLED_KEYS = { applied: "assistant.applied", adjusted: "assistant.adjusted", declined: "assistant.dismissed", alternatives: "assistant.alternativesSent" } as const;

/**
 * Aria, the planning assistant (Rose Garden). A chat that suggests checked
 * changes to this plan; each suggestion shows what changes and its effect on
 * the estimate, and nothing changes until the couple taps Apply (or Adjust,
 * then Apply selected). Every decision is logged on the plan. The brief and
 * the day-of timeline are edited here too. The conversation itself is kept
 * only in this page and never stored.
 */
export function PlanAssistant({
  open,
  onOpenChange,
  venue,
  spaces,
  catalogs,
  plan,
  planId,
  canUse,
  alerts,
  onSave,
  onApply,
  onOpenRequest,
  messages,
  setMessages,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  venue: CatalogVenue;
  spaces: SpaceRow[];
  catalogs: VendorCatalog[];
  plan: PlanDraft;
  /** The saved plan's id; Aria needs a saved plan. */
  planId: string | null;
  /** A saved plan of a signed-in couple. */
  canUse: boolean;
  alerts: AriaAlert[];
  onSave: () => void;
  onApply: (next: PlanDraft) => void;
  /** Go to the Estimate step, where the couple reviews and sends a confirmation request. */
  onOpenRequest: () => void;
  messages: ChatMessage[];
  setMessages: (update: (prev: ChatMessage[]) => ChatMessage[]) => void;
}) {
  const { t, locale, date } = useLocale();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("chat");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy, tab]);

  const perPiece = useMemo(() => {
    const units = new Map<string, string>();
    for (const c of catalogs) {
      for (const i of c.items) units.set(`item:${c.uid}:${i.id}`, i.unit);
      for (const p of c.packages) units.set(`package:${c.uid}:${p.id}`, p.unit);
    }
    return (key: string) => units.get(key) === "piece";
  }, [catalogs]);

  const estimateOf = useMemo(
    () => (p: PlanDraft) => {
      const space = spaces.find((s) => s.id === p.spaceId) ?? null;
      return buildPlanEstimates({ plan: p, venueOwnerUid: venue.ownerUid, space, catalogs }).combinedTotalCents;
    },
    [spaces, venue.ownerUid, catalogs],
  );

  async function send(text: string) {
    text = text.trim();
    if (!text || busy || !canUse) return;
    const mine: ChatMessage = { role: "user", text };
    const history: ChatMessage[] = [...messages, mine];
    // Functional update: a card marked settled just before this send keeps its state.
    setMessages((prev) => [...prev, mine]);
    setTab("chat");
    setBusy(true);
    setError(null);
    const r = await askAssistant({ venueId: venue.id, plan, history, locale, estimateTotalCents: estimateOf(plan) });
    setBusy(false);
    if (!r.ok) {
      setError(r.error.kind === "limit" ? r.error.message : t("assistant.failed"));
      return;
    }
    setRemaining(r.remainingToday);
    setMessages((prev) => [...prev, { role: "model", text: r.reply, proposals: r.proposals, shortlist: r.shortlist, offerRequest: r.offerRequest, demo: r.demo }]);
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
      case "budget":
        return t("assistant.change.budget", { amount: formatSGD(c.cents) });
      case "brief":
        return t("assistant.change.brief");
      case "timeline":
        return t("assistant.change.timeline", { count: c.entries.length });
    }
  };

  function markSettled(mi: number, pi: number, how: Settled) {
    setMessages((prev) => prev.map((x, i) => (i === mi ? { ...x, settled: { ...x.settled, [pi]: how } } : x)));
  }

  /** Record a decision on the plan. A failed log never undoes the couple's change. */
  function record(how: Settled, p: Proposal, changes: Change[], before: number, after: number) {
    if (!planId) return;
    logDecision(planId, { action: how, summary: p.label ? `${p.label}: ${p.summary}` : p.summary, changes: changes.map(describe), beforeCents: before, afterCents: after }).catch(() =>
      toast({ title: t("assistant.logFailed"), tone: "error" }),
    );
  }

  function settle(mi: number, pi: number, how: Settled, changes?: Change[]) {
    const p = messages[mi]?.proposals?.[pi];
    if (!p) return;
    const used = changes ?? p.changes;
    const before = estimateOf(plan);
    if (how === "applied" || how === "adjusted") {
      const next = applyProposal(plan, used, catalogs);
      onApply(next);
      record(how, p, used, before, estimateOf(next));
    } else record(how, p, p.changes, before, before);
    markSettled(mi, pi, how);
    if (how === "alternatives") void send(t("assistant.alternativesPrompt", { summary: p.summary || describe(p.changes[0]!) }));
  }

  function saveFromTab(next: PlanDraft, message: string) {
    onApply(next);
    toast({ title: message, tone: "success" });
  }

  const showDemo = messages.some((m) => m.demo);

  const footer = !canUse ? (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <p className="text-small text-muted">{t("assistant.saveFirst")}</p>
      <Button variant="primary" onClick={onSave}>
        {t("assistant.saveCta")}
      </Button>
    </div>
  ) : tab === "chat" ? (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const text = draft;
        setDraft("");
        void send(text);
      }}
      className="flex w-full flex-col gap-2"
    >
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
              e.currentTarget.form?.requestSubmit();
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
  ) : tab === "brief" ? (
    <Button type="submit" form={BRIEF_FORM_ID} variant="primary">
      {t("assistant.brief.save")}
    </Button>
  ) : tab === "timeline" ? (
    <Button type="submit" form={TIMELINE_FORM_ID} variant="primary">
      {t("assistant.timeline.save")}
    </Button>
  ) : null;

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        // Aria always opens on the chat, where her alerts are.
        if (!o) setTab("chat");
        onOpenChange(o);
      }}
      title={t("assistant.title")} description={t("assistant.description")} className="sm:max-w-2xl" footer={footer}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/rose-garden" className="text-small font-semibold text-accent-text underline underline-offset-4">
            {t("assistant.roseGarden")}
          </Link>
          {showDemo && <Badge tone="sample">{t("assistant.demo")}</Badge>}
        </div>

        {canUse && (
          <div
            role="tablist"
            aria-label={t("assistant.tabsLabel")}
            className="flex flex-wrap gap-1 rounded-3xl bg-subtle p-1"
            onKeyDown={(e) => {
              const i = TABS.indexOf(tab);
              const j = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i + TABS.length - 1) % TABS.length : -1;
              if (j < 0) return;
              e.preventDefault();
              setTab(TABS[j]!);
              tabRefs.current[j]?.focus();
            }}
          >
            {TABS.map((id, i) => (
              <button
                key={id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                id={`aria-tab-${id}`}
                role="tab"
                type="button"
                aria-selected={tab === id}
                aria-controls={`aria-panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                className={cn(
                  "min-h-11 shrink-0 rounded-full px-4 text-small font-semibold transition-colors",
                  tab === id ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
                )}
              >
                {t(TAB_KEYS[id])}
              </button>
            ))}
          </div>
        )}

        <div role={canUse ? "tabpanel" : undefined} id={`aria-panel-${tab}`} aria-labelledby={canUse ? `aria-tab-${tab}` : undefined}>
          {(tab === "chat" || !canUse) && (
            <div className="flex flex-col gap-3">
              {canUse && <AriaAlerts alerts={alerts} onAsk={(a) => void send(t(ALERT_PROMPT_KEYS[a.kind]))} />}
              <div ref={listRef} role="log" aria-live="polite" aria-label={t("assistant.title")} className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto pr-1">
                <Bubble role="model" label={t("assistant.ai")}>
                  {t("assistant.intro")}
                </Bubble>
                {messages.map((m, mi) => (
                  <div key={mi} className="flex flex-col gap-2">
                    <Bubble role={m.role} label={m.role === "user" ? t("assistant.you") : t("assistant.ai")}>
                      {m.text}
                    </Bubble>
                    {m.proposals?.map((p, pi) => (
                      <ProposalCard
                        key={pi}
                        proposal={p}
                        settled={m.settled?.[pi]}
                        describe={describe}
                        perPiece={perPiece}
                        estimate={(changes) => ({ before: estimateOf(plan), after: estimateOf(applyProposal(plan, changes, catalogs)) })}
                        onSettle={(how, changes) => settle(mi, pi, how, changes)}
                      />
                    ))}
                    {m.shortlist && m.shortlist.length > 0 && (
                      <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 sm:ml-8">
                        <p className="text-small font-semibold">{t("assistant.shortlist.title")}</p>
                        <ul className="flex flex-col gap-2">
                          {m.shortlist.map((v) => (
                            <li key={v.venueId} className="flex flex-col gap-0.5">
                              <Link href={`/studio/${v.venueId}`} className="inline-flex min-h-11 w-fit items-center gap-1.5 font-semibold text-accent-text underline underline-offset-4">
                                {t("assistant.shortlist.open", { venue: v.venueName })}
                                <ArrowRight aria-hidden className="size-4" />
                              </Link>
                              {v.reason && <span className="text-small text-muted">{v.reason}</span>}
                            </li>
                          ))}
                        </ul>
                        <p className="text-small text-muted">{t("assistant.shortlist.note")}</p>
                      </section>
                    )}
                    {m.offerRequest && (
                      <section className="flex flex-col items-start gap-2 rounded-xl border border-line bg-surface p-3 sm:ml-8">
                        <p className="text-small font-semibold">{t("assistant.request.title")}</p>
                        <p className="text-small text-muted">{t("assistant.request.body")}</p>
                        <Button
                          onClick={() => {
                            setTab("chat");
                            onOpenRequest();
                          }}
                        >
                          {t("assistant.request.open")}
                        </Button>
                      </section>
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
          )}
          {canUse && tab === "brief" && (
            <AriaBrief
              plan={plan}
              onSave={(next) => saveFromTab(next, t("assistant.brief.saved"))}
              onPlanFromBrief={(next) => {
                onApply(next);
                void send(t("assistant.brief.planPrompt"));
              }}
            />
          )}
          {canUse && tab === "timeline" && <AriaTimeline plan={plan} onSave={(next) => saveFromTab(next, t("assistant.timeline.saved"))} onAsk={() => void send(t("assistant.timeline.askPrompt"))} />}
          {canUse && tab === "decisions" && planId && <AriaDecisions planId={planId} />}
        </div>
      </div>
    </Modal>
  );
}

/** One suggestion: what changes, its effect on the estimate, and the four choices. */
function ProposalCard({
  proposal,
  settled,
  describe,
  perPiece,
  estimate,
  onSettle,
}: {
  proposal: Proposal;
  settled: Settled | undefined;
  describe: (c: Change) => string;
  perPiece: (key: string) => boolean;
  estimate: (changes: Change[]) => { before: number; after: number };
  onSettle: (how: Settled, changes?: Change[]) => void;
}) {
  const { t } = useLocale();
  const [adjusting, setAdjusting] = useState(false);
  const [keep, setKeep] = useState<boolean[]>(() => proposal.changes.map(() => true));
  const [numbers, setNumbers] = useState<Record<number, number>>({});
  const changes = adjusting ? adjustChanges(proposal.changes, keep, numbers) : proposal.changes;
  const { before, after } = estimate(changes);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-accent bg-surface p-3 sm:ml-8">
      <p className="text-small font-semibold">{proposal.label || t("assistant.suggestion")}</p>
      {proposal.label && proposal.summary && <p className="text-small">{proposal.summary}</p>}
      {adjusting ? (
        <div className="flex flex-col gap-1">
          <p className="text-small text-muted">{t("assistant.adjustHint")}</p>
          {proposal.changes.map((c, j) => {
            const n = editableNumber(c, perPiece);
            return (
              <div key={j} className="flex flex-wrap items-end gap-3">
                <Checkbox label={describe(c)} checked={keep[j]} onCheckedChange={(v) => setKeep((k) => k.map((x, i) => (i === j ? v : x)))} className="min-w-0 flex-1" />
                {n !== null && keep[j] && (
                  <Input
                    label={t("assistant.adjust.number", { change: describe(c) })}
                    type="number"
                    min={1}
                    className="w-40 [&_label]:sr-only"
                    value={numbers[j] ?? n}
                    onChange={(e) => setNumbers((x) => ({ ...x, [j]: Math.trunc(Number(e.target.value)) }))}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="flex list-disc flex-col gap-0.5 pl-5 text-small">
          {proposal.changes.map((c, j) => (
            <li key={j}>{describe(c)}</li>
          ))}
        </ul>
      )}
      <p className="num text-small text-muted">
        {before === after ? t("assistant.costSame", { total: formatSGD(before) }) : t("assistant.costChange", { from: formatSGD(before), to: formatSGD(after) })}{" "}
        <Badge tone="estimate">{t("badge.estimate")}</Badge>
      </p>
      {settled ? (
        <p role="status" className="text-small font-semibold">
          {t(SETTLED_KEYS[settled])}
        </p>
      ) : adjusting ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onSettle("adjusted", changes)} disabled={changes.length === 0} icon={<Sparkles aria-hidden className="size-4" />}>
            {t("assistant.applySelected")}
          </Button>
          <Button variant="ghost" onClick={() => setAdjusting(false)}>
            {t("assistant.cancelAdjust")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onSettle("applied")} icon={<Sparkles aria-hidden className="size-4" />}>
            {t("assistant.apply")}
          </Button>
          <Button variant="ghost" onClick={() => setAdjusting(true)}>
            {t("assistant.adjust")}
          </Button>
          <Button variant="ghost" onClick={() => onSettle("alternatives")}>
            {t("assistant.alternatives")}
          </Button>
          <Button variant="ghost" onClick={() => onSettle("declined")}>
            {t("assistant.dismiss")}
          </Button>
        </div>
      )}
    </div>
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
