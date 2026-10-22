"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, RefreshCw, Sparkles, WandSparkles } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { BeforeAfterSlider } from "@/components/ui/before-after-slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { photoUrl } from "@/lib/data/venues";
import { RenderError, requestRender, type RenderRequest, type RenderResult } from "@/lib/data/renders";
import { getFirebase } from "@/lib/firebase/client";
import { useLocale } from "@/lib/i18n/provider";
import { crossFade, slideDown } from "@/lib/motion";
import { themeLabelT } from "@/lib/render/themes";
import type { StoredPhoto } from "@/lib/venues/model";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; result: RenderResult; renderUrl: string; roomUrl: string; requestSig: string; roomKey: string }
  | { kind: "error"; message: string };

const signature = (r: RenderRequest) => JSON.stringify([r.venueId, r.spaceId, r.themeId, r.items.map((i) => `${i.vendorUid}/${i.itemId}`).sort()]);

/**
 * Shows the real room decorated with only the selected items. Every render
 * carries the "AI illustration" note. Changing theme or items needs a new render.
 */
export function RenderPanel({
  request,
  roomPhoto,
  disabledReason,
  onRendered,
  actions,
}: {
  request: RenderRequest | null;
  roomPhoto: StoredPhoto | null;
  disabledReason?: string | null;
  /** Called with each finished render (for saving it to a plan). */
  onRendered?: (result: RenderResult) => void;
  /** Extra buttons shown under a finished render, e.g. "Save this render". */
  actions?: React.ReactNode;
}) {
  const { t, date } = useLocale();
  const [raw, setState] = useState<State>({ kind: "idle" });
  const [details, setDetails] = useState(false);
  const detailsId = useId();
  const sig = useMemo(() => (request ? signature(request) : ""), [request]);
  const roomKey = request ? `${request.venueId}/${request.spaceId}` : "";
  // A render of a different room is no longer relevant: show the idle state.
  const state: State = raw.kind === "done" && raw.roomKey !== roomKey ? { kind: "idle" } : raw;
  const stale = state.kind === "done" && state.requestSig !== sig;
  const aspect = roomPhoto ? `${roomPhoto.width} / ${roomPhoto.height}` : "4 / 3";
  const unoptimized = useMemo(() => {
    try {
      return getFirebase().settings.useEmulators;
    } catch {
      return false;
    }
  }, []);

  async function run() {
    if (!request || !roomPhoto) return;
    setState({ kind: "loading" });
    try {
      const result = await requestRender(request);
      const [renderUrl, roomUrl] = await Promise.all([photoUrl(result.path), photoUrl(roomPhoto.path)]);
      setState({ kind: "done", result, renderUrl, roomUrl, requestSig: signature(request), roomKey: `${request.venueId}/${request.spaceId}` });
      onRendered?.(result);
    } catch (err) {
      setState({ kind: "error", message: err instanceof RenderError ? err.message : t("render.failed") });
    }
  }

  const blocked = !request || !roomPhoto ? (disabledReason ?? t("render.chooseRoom")) : (disabledReason ?? null);

  return (
    <section aria-labelledby={`${detailsId}-h`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${detailsId}-h`} className="text-h3">
          {t("render.seeItDecorated")}
        </h2>
        <Button
          variant="primary"
          onClick={run}
          loading={state.kind === "loading"}
          disabled={!!blocked || (state.kind === "done" && !stale)}
          icon={state.kind === "done" ? <RefreshCw aria-hidden className="size-4" /> : <WandSparkles aria-hidden className="size-4" />}
        >
          {state.kind === "done" ? t("render.renderAgain") : t("render.showItDecorated")}
        </Button>
      </div>
      {blocked && <p className="text-small text-muted">{blocked}</p>}

      <AnimatePresence initial={false}>
        {stale && (
          <motion.p variants={slideDown} initial="hidden" animate="visible" exit="exit" className="rounded-lg border border-warning-icon bg-surface p-3 text-small font-medium text-warning">
            {t("render.stale")}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Fixed-ratio frame so nothing jumps between states. */}
      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false}>
          {state.kind === "loading" && (
            <motion.div key="loading" variants={crossFade} initial="hidden" animate="visible" exit="exit" className="relative overflow-hidden rounded-xl" style={{ aspectRatio: aspect }}>
              <Skeleton className="absolute inset-0 rounded-xl" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-muted">
                <Sparkles aria-hidden className="size-6 text-gold" />
                <p className="font-display text-h3 text-ink">{t("render.decorating")}</p>
                <p className="text-small">{t("render.underMinute")}</p>
              </div>
            </motion.div>
          )}
          {state.kind === "done" && (
            <motion.div key={state.result.key} variants={crossFade} initial="hidden" animate="visible" exit="exit">
              <BeforeAfterSlider
                before={{ src: state.roomUrl, alt: t("render.beforeAlt") }}
                after={{
                  src: state.renderUrl,
                  alt: t("render.afterAlt", { theme: themeLabelT(t, state.result.themeId), items: state.result.itemNames.join(", ") || t("render.noDecorItems") }),
                }}
                beforeLabel={t("render.today")}
                afterLabel={state.result.demo ? t("render.demo") : t("render.decorated")}
                aspect={aspect}
                unoptimized={unoptimized}
                sizes="(min-width: 64rem) 60vw, 100vw"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {state.kind === "error" && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-error bg-surface p-4">
          <p className="font-medium text-error">{state.message}</p>
          <p className="text-small text-muted">{t("render.noAllowanceUsed")}</p>
        </div>
      )}

      {state.kind === "done" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-small text-muted">{t("render.aiNote")}</p>
            {state.result.demo && <Badge tone="warning">{t("render.demoBadge")}</Badge>}
          </div>
          {actions && !stale && <div className="flex flex-wrap gap-2">{actions}</div>}
          <button
            type="button"
            aria-expanded={details}
            aria-controls={detailsId}
            onClick={() => setDetails((d) => !d)}
            className="inline-flex min-h-11 w-fit items-center gap-1.5 text-small font-semibold text-accent-text"
          >
            {t("render.details")}
            <ChevronDown aria-hidden className={`size-4 transition-transform duration-200 ${details ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {details && (
              <motion.dl
                id={detailsId}
                variants={slideDown}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="grid gap-x-6 gap-y-1 rounded-lg bg-subtle p-4 text-small sm:grid-cols-[10rem_1fr]"
              >
                <dt className="text-muted">{t("render.theme")}</dt>
                <dd>{themeLabelT(t, state.result.themeId)}</dd>
                <dt className="text-muted">{t("render.decorShown")}</dt>
                <dd>{state.result.itemNames.length ? state.result.itemNames.join(", ") : t("render.noneLighting")}</dd>
                <dt className="text-muted">{t("render.madeWith")}</dt>
                <dd>{state.result.demo ? t("render.demoMode") : state.result.model}</dd>
                <dt className="text-muted">{t("render.created")}</dt>
                <dd>{date(new Date(state.result.createdAt).getTime(), { dateStyle: "medium", timeStyle: "short" })}</dd>
                <dt className="text-muted">{t("render.allowance")}</dt>
                <dd>{state.result.cacheHit ? t("render.reused") : t("render.usedOne")}</dd>
                <dt className="text-muted">{t("render.note")}</dt>
                <dd>{t("render.noteText")}</dd>
              </motion.dl>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* One calm announcement for screen readers. */}
      <p className="sr-only" aria-live="polite">
        {state.kind === "loading" ? t("render.announceLoading") : state.kind === "done" ? t("render.announceReady") : ""}
      </p>
    </section>
  );
}
