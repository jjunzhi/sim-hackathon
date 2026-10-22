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
import { crossFade, slideDown } from "@/lib/motion";
import { themeLabel } from "@/lib/render/themes";
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
      setState({ kind: "error", message: err instanceof RenderError ? err.message : "We couldn't create this render. Please try again." });
    }
  }

  const blocked = !request || !roomPhoto ? (disabledReason ?? "Choose a room with a photo to render it.") : (disabledReason ?? null);

  return (
    <section aria-labelledby={`${detailsId}-h`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${detailsId}-h`} className="text-h3">
          See it decorated
        </h2>
        <Button
          variant="primary"
          onClick={run}
          loading={state.kind === "loading"}
          disabled={!!blocked || (state.kind === "done" && !stale)}
          icon={state.kind === "done" ? <RefreshCw aria-hidden className="size-4" /> : <WandSparkles aria-hidden className="size-4" />}
        >
          {state.kind === "done" ? "Render again" : "Show it decorated"}
        </Button>
      </div>
      {blocked && <p className="text-small text-muted">{blocked}</p>}

      <AnimatePresence initial={false}>
        {stale && (
          <motion.p variants={slideDown} initial="hidden" animate="visible" exit="exit" className="rounded-lg border border-warning-icon bg-surface p-3 text-small font-medium text-warning">
            Your theme or items changed. Render again to see them.
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
                <p className="font-display text-h3 text-ink">Decorating your room...</p>
                <p className="text-small">This usually takes under a minute.</p>
              </div>
            </motion.div>
          )}
          {state.kind === "done" && (
            <motion.div key={state.result.key} variants={crossFade} initial="hidden" animate="visible" exit="exit">
              <BeforeAfterSlider
                before={{ src: state.roomUrl, alt: "The room as it is today" }}
                after={{
                  src: state.renderUrl,
                  alt: `AI illustration of the room in the ${themeLabel(state.result.themeId)} theme with ${state.result.itemNames.join(", ") || "no decor items"}`,
                }}
                beforeLabel="Today"
                afterLabel={state.result.demo ? "Demo" : "Decorated"}
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
          <p className="text-small text-muted">Nothing was used from your render allowance.</p>
        </div>
      )}

      {state.kind === "done" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-small text-muted">AI illustration. Final decor may differ.</p>
            {state.result.demo && <Badge tone="warning">DEMO: not an AI render</Badge>}
          </div>
          {actions && !stale && <div className="flex flex-wrap gap-2">{actions}</div>}
          <button
            type="button"
            aria-expanded={details}
            aria-controls={detailsId}
            onClick={() => setDetails((d) => !d)}
            className="inline-flex min-h-11 w-fit items-center gap-1.5 text-small font-semibold text-accent-text"
          >
            Visualization details
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
                <dt className="text-muted">Theme</dt>
                <dd>{themeLabel(state.result.themeId)}</dd>
                <dt className="text-muted">Decor shown</dt>
                <dd>{state.result.itemNames.length ? state.result.itemNames.join(", ") : "None (lighting and colour only)"}</dd>
                <dt className="text-muted">Made with</dt>
                <dd>{state.result.demo ? "DEMO mode: the real photo with a colour wash, no AI" : state.result.model}</dd>
                <dt className="text-muted">Created</dt>
                <dd>{new Date(state.result.createdAt).toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" })}</dd>
                <dt className="text-muted">Allowance</dt>
                <dd>{state.result.cacheHit ? "Reused a saved render, so none of your allowance was used" : "Used 1 render from your allowance"}</dd>
                <dt className="text-muted">Note</dt>
                <dd>Only items the vendor can really deliver are shown. Layout, scale and colours are approximate.</dd>
              </motion.dl>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* One calm announcement for screen readers. */}
      <p className="sr-only" aria-live="polite">
        {state.kind === "loading" ? "Decorating your room." : state.kind === "done" ? "Render ready." : ""}
      </p>
    </section>
  );
}
