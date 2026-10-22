import { THEMES } from "../render/themes.js";
import type { PlanSnapshot, VenueContext } from "./proposal.js";

/**
 * DEMO mode (no Gemini key): a tiny rule-based stand-in so the chat, the
 * proposal card and Apply can be used and tested without any AI call. Every
 * reply says it is a DEMO. It understands guest numbers, theme names,
 * "add <item>" and "remove <item>", and nothing else.
 */
export function demoReply(message: string, ctx: VenueContext, plan: PlanSnapshot): { text: string; args: Record<string, unknown> | null } {
  const m = message.toLowerCase();
  const args: Record<string, unknown> = {};
  const done: string[] = [];

  const guests = /(\d{1,4})\s*(guests|pax|people|persons)/.exec(m);
  if (guests) {
    args.headcount = Number(guests[1]);
    done.push(`${guests[1]} guests`);
  }
  const theme = THEMES.find((t) => m.includes(t.label.toLowerCase()) || m.includes(t.id));
  if (theme) {
    args.themeId = theme.id;
    done.push(`the ${theme.label} theme`);
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

  if (!done.length) {
    return {
      text: "DEMO assistant: the AI planner isn't switched on yet, so I only understand simple requests such as \"150 guests\", a theme name, \"add <item>\" or \"remove <item>\".",
      args: null,
    };
  }
  args.summary = `DEMO suggestion: update the plan to ${done.join("; ")}.`;
  return { text: `DEMO assistant: here's a suggested change to ${done.join("; ")}. Check the cost and tap Apply if you'd like it.`, args };
}
