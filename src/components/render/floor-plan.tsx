"use client";

import { Download } from "lucide-react";
import { useId, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { featuresFrom, layoutFloorPlan, PLAN_H, PLAN_W, type Box } from "@/lib/plans/floor-plan";

/**
 * The plan's suggested floor plan, drawn from its real numbers: the room,
 * guests, seats per table and chosen items. Not to scale, and it says so.
 */
export function FloorPlan({
  roomName,
  headcount,
  seatsPerTable,
  items,
  fileName,
}: {
  roomName: string;
  headcount: number;
  seatsPerTable: number;
  /** Chosen items and the items inside chosen packages (name and category). */
  items: Array<{ name: string; category: string }>;
  fileName: string;
}) {
  const t = useT();
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const features = useMemo(() => featuresFrom(items), [items]);
  const plan = useMemo(() => layoutFloorPlan({ headcount, seatsPerTable, features }), [headcount, seatsPerTable, features]);
  const stageLabel = features.stageItem ?? t("floor.stage");
  const showSeats = plan.tables[0] ? plan.tables[0].r >= 16 : false;
  const label = (b: Box, text: string, vertical = false) => (
    <text
      x={b.x + b.w / 2}
      y={b.y + b.h / 2}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={vertical ? 16 : 18}
      fontWeight={600}
      fill="#2a2325"
      transform={vertical ? `rotate(-90 ${b.x + b.w / 2} ${b.y + b.h / 2})` : undefined}
    >
      {text}
    </text>
  );

  function download() {
    const svg = svgRef.current;
    if (!svg) return;
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}-floor-plan.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const summary = t("floor.summary", { count: plan.tableCount, seats: seatsPerTable, guests: headcount });

  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 id={`${id}-h`} className="text-h3">
            {t("floor.title")}
          </h3>
          <p className="num text-small text-muted">
            {roomName} · {summary}
          </p>
        </div>
        <Button onClick={download} icon={<Download aria-hidden className="size-4" />}>
          {t("floor.download")}
        </Button>
      </div>
      <figure className="flex flex-col gap-2">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${PLAN_W} ${PLAN_H}`}
          role="img"
          aria-labelledby={`${id}-title ${id}-desc`}
          className="h-auto w-full rounded-xl border border-line bg-[#fbf7f2]"
          fontFamily="Arial, Helvetica, sans-serif"
        >
          <title id={`${id}-title`}>{t("floor.title")}</title>
          <desc id={`${id}-desc`}>{summary}</desc>
          <rect x="12" y="12" width={PLAN_W - 24} height={PLAN_H - 24} rx="10" fill="#fffdf9" stroke="#8c7b70" strokeWidth="6" />
          {/* Stage */}
          <rect x={plan.stage.x} y={plan.stage.y} width={plan.stage.w} height={plan.stage.h} rx="10" fill="#e9c7cf" stroke="#b84c60" strokeWidth="3" />
          {label(plan.stage, stageLabel)}
          {plan.solemnisation && (
            <>
              <rect x={plan.solemnisation.x} y={plan.solemnisation.y} width={plan.solemnisation.w} height={plan.solemnisation.h} rx="8" fill="#f1e2c4" stroke="#b8935a" strokeWidth="2" />
              {label(plan.solemnisation, t("floor.solemnisation"))}
            </>
          )}
          {plan.danceFloor && (
            <>
              <rect x={plan.danceFloor.x} y={plan.danceFloor.y} width={plan.danceFloor.w} height={plan.danceFloor.h} fill="#efe6da" stroke="#cdbfae" strokeWidth="2" strokeDasharray="10 8" />
              {label(plan.danceFloor, t("floor.danceFloor"))}
            </>
          )}
          {plan.buffet && (
            <>
              <rect x={plan.buffet.x} y={plan.buffet.y} width={plan.buffet.w} height={plan.buffet.h} rx="8" fill="#f3dfc1" stroke="#c98f4b" strokeWidth="2" />
              {label(plan.buffet, t("floor.buffet"), true)}
            </>
          )}
          {plan.dessert && (
            <>
              <rect x={plan.dessert.x} y={plan.dessert.y} width={plan.dessert.w} height={plan.dessert.h} rx="8" fill="#f2d6e2" stroke="#c98fb0" strokeWidth="2" />
              {label(plan.dessert, t("floor.dessert"), true)}
            </>
          )}
          {/* Tables, numbered from the stage */}
          {plan.tables.map((tb) => (
            <g key={tb.n}>
              {showSeats &&
                Array.from({ length: tb.seats }, (_, s) => {
                  const a = (s / tb.seats) * Math.PI * 2;
                  return <circle key={s} cx={tb.cx + Math.cos(a) * (tb.r + 7)} cy={tb.cy + Math.sin(a) * (tb.r + 7)} r={4.5} fill="#cdbfae" />;
                })}
              <circle cx={tb.cx} cy={tb.cy} r={tb.r} fill="#ffffff" stroke="#8c7b70" strokeWidth="2" />
              <text x={tb.cx} y={tb.cy} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(9, Math.min(18, tb.r * 0.75))} fill="#2a2325">
                {tb.n}
              </text>
            </g>
          ))}
          {/* Entrance, with the arch if one is chosen */}
          <rect x={plan.entrance.x} y={plan.entrance.y} width={plan.entrance.w} height={plan.entrance.h} fill="#fffdf9" />
          {features.arch && <path d={`M${plan.entrance.x + 30} ${plan.entrance.y} A60 46 0 0 1 ${plan.entrance.x + plan.entrance.w - 30} ${plan.entrance.y}`} fill="none" stroke="#b84c60" strokeWidth="6" strokeLinecap="round" />}
          <text x={PLAN_W / 2} y={PLAN_H - 34} textAnchor="middle" fontSize="16" fontWeight={600} fill="#6b5d55">
            {features.arch ? t("floor.entranceArch") : t("floor.entrance")}
          </text>
        </svg>
        <figcaption className="flex flex-col gap-1 text-small text-muted">
          <span>{t("floor.note")}</span>
          {plan.notDrawn > 0 && <span>{t("floor.notDrawn", { count: plan.notDrawn })}</span>}
        </figcaption>
      </figure>
    </section>
  );
}
