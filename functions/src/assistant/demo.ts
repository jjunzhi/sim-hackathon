import { THEMES } from "../render/themes.js";
import type { ModelAnswer } from "./assistant.js";
import type { PlanFacts } from "./prompt.js";
import type { PlanSnapshot, VenueContext } from "./proposal.js";
import { BRIEF_TRADITIONS } from "./types.js";

const DEMO_HELP =
  'DEMO Aria: the AI isn\'t switched on yet, so I only understand simple requests such as "150 guests", "budget $40,000", a theme name, "halal", "add <item>", "remove <item>", "timeline", "other venues", "over budget", "too many guests" or "confirm prices".';

const DIET_WORDS: Array<[RegExp, string]> = [
  [/\bhalal\b/, "halal"],
  [/\bvegan\b/, "vegan"],
  [/\bvegetarian\b/, "vegetarian"],
  [/\bno[- ]beef\b/, "no-beef"],
  [/\bno[- ]pork\b/, "no-pork"],
];

/** A plain sample day, labelled as a DEMO draft. */
const DEMO_TIMELINE = [
  { time: "10:00", label: "DEMO: Couple and family get ready" },
  { time: "11:30", label: "DEMO: Guests arrive" },
  { time: "12:00", label: "DEMO: Ceremony (check times with your officiant)" },
  { time: "13:00", label: "DEMO: Lunch reception" },
  { time: "15:00", label: "DEMO: Speeches and toasts" },
  { time: "16:00", label: "DEMO: Farewell" },
];

/** "Option A", "Option B"... in order, for the suggestions only. */
function lettered(calls: ModelAnswer["calls"]): ModelAnswer["calls"] {
  let n = 0;
  return calls.map((c) => (c.name === "propose_plan_changes" ? { ...c, args: { ...c.args, label: `Option ${String.fromCharCode(65 + n++)}` } } : c));
}

/**
 * DEMO mode (no Gemini key): a small rule-based stand-in so the chat, the
 * suggestion cards, options, shortlists and Apply can be used and tested
 * without any AI call. Every reply and suggestion says DEMO.
 */
export function demoReply(message: string, ctx: VenueContext, plan: PlanSnapshot, facts: PlanFacts): ModelAnswer {
  const m = message.toLowerCase();
  const calls: ModelAnswer["calls"] = [];
  const room = ctx.spaces.find((s) => s.id === plan.spaceId) ?? null;

  // Trade-offs: offer up to three labelled options.
  if (/over budget|cut costs|cheaper|options/.test(m)) {
    const chosen = Object.keys(plan.selections)
      .map((k) => ctx.options.find((o) => o.key === k))
      .filter((o): o is NonNullable<typeof o> => !!o)
      .sort((a, b) => b.priceCents - a.priceCents);
    if (chosen[0]) calls.push({ name: "propose_plan_changes", args: { summary: `DEMO option: remove ${chosen[0].name}.`, remove: [chosen[0].key] } });
    if (room?.tiers.offPeak && plan.tierKey !== "offPeak") calls.push({ name: "propose_plan_changes", args: { summary: "DEMO option: choose Off-Peak pricing for this room.", tierKey: "offPeak" } });
    const fewer = Math.max(room?.capacityMin ?? 1, Math.floor(plan.headcount * 0.9));
    if (fewer < plan.headcount) calls.push({ name: "propose_plan_changes", args: { summary: `DEMO option: plan for ${fewer} guests.`, headcount: fewer } });
    return { text: calls.length ? "DEMO Aria: here are some ways to bring the estimate down. Nothing changes until you choose one." : DEMO_HELP, calls: lettered(calls) };
  }
  if (/too many guests|over capacity|bigger room/.test(m)) {
    const need = Math.max(plan.headcount, facts.guests?.total ?? 0);
    const bigger = ctx.spaces.find((s) => s.id !== plan.spaceId && need >= s.capacityMin && need <= s.capacityMax);
    if (bigger) calls.push({ name: "propose_plan_changes", args: { summary: `DEMO option: move to ${bigger.name}, which fits ${need} guests.`, spaceId: bigger.id } });
    if (room && plan.headcount > room.capacityMax)
      calls.push({ name: "propose_plan_changes", args: { summary: `DEMO option: plan for ${room.capacityMax} guests, this room's maximum.`, headcount: room.capacityMax } });
    const fits = (ctx.venues ?? []).filter((v) => v.ranges.some((r) => need >= r.min && need <= r.max)).slice(0, 5);
    if (fits.length) calls.push({ name: "shortlist_venues", args: { venues: fits.map((v) => ({ venueId: v.id, reason: `DEMO: has a room for ${need} guests.` })) } });
    return { text: calls.length ? "DEMO Aria: here are some ways to fit everyone. I never suggest removing particular guests." : DEMO_HELP, calls: lettered(calls) };
  }
  if (/other venues|shortlist|more venues/.test(m)) {
    const fits = (ctx.venues ?? []).filter((v) => v.ranges.some((r) => plan.headcount >= r.min && plan.headcount <= r.max)).slice(0, 5);
    if (fits.length) calls.push({ name: "shortlist_venues", args: { venues: fits.map((v) => ({ venueId: v.id, reason: `DEMO: has a room for ${plan.headcount} guests.` })) } });
    return { text: fits.length ? "DEMO Aria: these listed venues have a room for your guest count." : "DEMO Aria: I couldn't find another listed venue for that guest count.", calls };
  }
  if (/confirm prices|request|quote/.test(m)) {
    calls.push({ name: "offer_confirmation_request", args: {} });
    return { text: "DEMO Aria: you can ask the vendors in this plan to confirm their prices. You review the request and send it yourself.", calls };
  }

  const args: Record<string, unknown> = {};
  const done: string[] = [];
  const guests = /(\d{1,4})\s*(guests|pax|people|persons)/.exec(m);
  if (guests) {
    args.headcount = Number(guests[1]);
    done.push(`${guests[1]} guests`);
  }
  const budget = /(?:budget|under)\D{0,12}?\$?\s?(\d[\d,]{2,})/.exec(m);
  if (budget) {
    args.budget = Number(budget[1]!.replace(/,/g, ""));
    done.push(`a budget of $${budget[1]}`);
  }
  const theme = THEMES.find((t) => m.includes(t.label.toLowerCase()) || m.includes(t.id));
  if (theme) {
    args.themeId = theme.id;
    done.push(`the ${theme.label} theme`);
  }
  const diets = DIET_WORDS.filter(([re]) => re.test(m)).map(([, tag]) => tag);
  if (diets.length) {
    args.dietaryTags = [...new Set([...(plan.brief?.dietaryTags ?? []), ...diets])];
    done.push(`menus that are ${diets.join(", ")}`);
  }
  const traditions = BRIEF_TRADITIONS.filter((t) => m.includes(t.toLowerCase()) && t !== "Halal-friendly");
  if (traditions.length) {
    args.traditions = [...new Set([...(plan.brief?.traditions ?? []), ...traditions])];
    done.push(`${traditions.join(" and ")} traditions`);
  }
  if (/step[- ]free|wheelchair/.test(m)) {
    args.stepFree = true;
    done.push("step-free access");
  }
  if (/timeline|run[- ]?sheet|schedule/.test(m)) {
    args.timeline = DEMO_TIMELINE;
    done.push("a draft day-of timeline");
  }
  const named = (verb: string) =>
    ctx.options.filter((o) => {
      const name = o.name.toLowerCase().replace(/^sample\s+/, "");
      return new RegExp(`${verb}\\s+(the\\s+|a\\s+)?(sample\\s+)?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(m);
    });
  const adds = named("add");
  if (adds.length) {
    args.add = adds.map((o) => ({ ref: o.key, quantity: 1 }));
    done.push(adds.map((o) => o.name).join(", "));
  }
  const removes = named("remove").filter((o) => plan.selections[o.key] !== undefined);
  if (removes.length) {
    args.remove = removes.map((o) => o.key);
    done.push(`without ${removes.map((o) => o.name).join(", ")}`);
  }

  if (!done.length) return { text: DEMO_HELP, calls: [] };
  args.summary = `DEMO suggestion: update the plan to ${done.join("; ")}.`;
  return { text: `DEMO Aria: here's a suggested change to ${done.join("; ")}. Check the cost and tap Apply if you'd like it.`, calls: [{ name: "propose_plan_changes", args }] };
}
