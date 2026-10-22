"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/auth/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SkeletonList } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth/auth-provider";
import { addCustomItem, removeCustomItem, setCustomDone, setTick, watchCustomItems, watchTicks, type CustomItem } from "@/lib/data/checklists";
import type { WithId } from "@/lib/data/venues";
import type { TKey } from "@/lib/i18n/dictionaries/types";
import { useT } from "@/lib/i18n/provider";
import { RITUAL_LIMITS, RITUALS, tickKey, type Ritual } from "@/lib/rituals/content";

export default function ChecklistsPage() {
  return (
    <RequireAuth role="couple">
      <AppHeader />
      <Checklists />
    </RequireAuth>
  );
}

const k = (s: string) => s as TKey;

function Checklists() {
  const auth = useAuth();
  const uid = auth.status === "ready" ? auth.user.uid : null;
  const t = useT();
  const [ticks, setTicks] = useState<Record<string, true> | null>(null);
  const [custom, setCustom] = useState<WithId<CustomItem>[] | null>(null);

  useEffect(() => {
    if (!uid) return;
    const subs = [watchTicks(uid, (d) => setTicks(d.ticks)), watchCustomItems(uid, setCustom)];
    return () => subs.forEach((u) => u());
  }, [uid]);

  return (
    <main className="container-page flex flex-col gap-8 py-10 pb-28 sm:pb-12">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h1">{t("checklists.title")}</h1>
          <Badge tone="neutral">{t("badge.needsReview")}</Badge>
        </div>
        <p className="max-w-2xl text-muted">{t("checklists.intro")}</p>
        <p role="note" className="max-w-2xl rounded-xl border border-line bg-subtle p-3 text-small text-muted">
          {t("checklists.reviewNote")}
        </p>
      </div>

      {!uid || ticks === null || custom === null ? (
        <SkeletonList rows={2} label={t("checklists.loading")} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {RITUALS.map((r) => (
            <RitualCard key={r.id} ritual={r} uid={uid} ticks={ticks} custom={custom.filter((c) => c.ritualId === r.id)} />
          ))}
        </div>
      )}
    </main>
  );
}

function RitualCard({ ritual, uid, ticks, custom }: { ritual: Ritual; uid: string; ticks: Record<string, true>; custom: WithId<CustomItem>[] }) {
  const t = useT();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const title = t(k(`ritual.${ritual.id}.title`));

  const { done, total } = useMemo(() => {
    const builtIn = ritual.groups.flatMap((g) => g.items.map((i) => tickKey(ritual.id, i)));
    return {
      done: builtIn.filter((key) => ticks[key]).length + custom.filter((c) => c.done).length,
      total: builtIn.length + custom.length,
    };
  }, [ritual, ticks, custom]);

  const fail = () => toast({ title: t("checklists.saveFailed"), tone: "error" });

  async function add(ev: React.FormEvent) {
    ev.preventDefault();
    const text = draft.trim().slice(0, RITUAL_LIMITS.customTextMax);
    if (!text) return;
    if (custom.length >= RITUAL_LIMITS.customPerChecklist) {
      toast({ title: t("checklists.customLimit", { max: RITUAL_LIMITS.customPerChecklist }), tone: "error" });
      return;
    }
    setAdding(true);
    try {
      await addCustomItem(uid, ritual.id, text);
      setDraft("");
    } catch {
      fail();
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-h3">{title}</h2>
            <span className="num text-small text-muted" aria-live="polite">
              {t("checklists.progress", { done, total })}
            </span>
          </div>
          <p className="text-small text-muted">{t(k(`ritual.${ritual.id}.summary`))}</p>
          <div role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle">
            <div className="h-full origin-left rounded-full bg-accent transition-transform duration-300" style={{ transform: `scaleX(${total ? done / total : 0})` }} />
          </div>
        </div>

        {ritual.groups.map((g) => (
          <fieldset key={g.id} className="flex flex-col gap-1">
            <legend className="mb-1 text-small font-semibold">{t(k(`checklists.group.${g.id}`))}</legend>
            {g.items.map((item) => {
              const key = tickKey(ritual.id, item);
              return <Checkbox key={item} label={t(k(`ritual.${ritual.id}.${g.id}.${item}`))} checked={!!ticks[key]} onCheckedChange={(c) => setTick(uid, key, c).catch(fail)} />;
            })}
          </fieldset>
        ))}

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-small font-semibold">{t("checklists.group.custom")}</legend>
          {custom.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2">
              <Checkbox label={c.text} checked={c.done} onCheckedChange={(on) => setCustomDone(uid, c.id, on).catch(fail)} />
              <button
                type="button"
                aria-label={t("checklists.removeItem", { item: c.text })}
                onClick={() => removeCustomItem(uid, c.id).catch(fail)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </div>
          ))}
          <form onSubmit={add} className="mt-1 flex flex-wrap items-end gap-2">
            <Input
              label={t("checklists.addItemLabel", { checklist: title })}
              value={draft}
              maxLength={RITUAL_LIMITS.customTextMax}
              onChange={(e) => setDraft(e.target.value)}
              className="min-w-0 flex-1"
            />
            <Button type="submit" loading={adding} disabled={!draft.trim()} icon={<Plus aria-hidden className="size-4" />}>
              {t("checklists.addItemButton")}
            </Button>
          </form>
        </fieldset>
      </CardBody>
    </Card>
  );
}
