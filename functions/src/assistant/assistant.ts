import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { FunctionCallingConfigMode, GoogleGenAI, Type, type FunctionDeclaration } from "@google/genai";
import { HttpsError } from "firebase-functions/https";
import { periodKeys } from "../render/quota.js";
import { THEMES } from "../render/themes.js";
import { demoReply } from "./demo.js";
import { ASSISTANT_MODEL, systemInstruction, venueDataBlock } from "./prompt.js";
import { validateProposal, type ContextOption, type ContextSpace, type PlanSnapshot, type Proposal, type TierKey, type VenueContext } from "./proposal.js";

/** Chat limits. Defaults here; an admin can override them in config/assistantLimits. */
export interface AssistantLimits {
  userPerDay: number;
  globalPerDay: number;
}
export const DEFAULT_ASSISTANT_LIMITS: AssistantLimits = { userPerDay: 30, globalPerDay: 3000 };

export function resolveAssistantLimits(override: unknown): AssistantLimits {
  const o = (override ?? {}) as Partial<Record<keyof AssistantLimits, unknown>>;
  const pick = (k: keyof AssistantLimits) => {
    const v = o[k];
    return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : DEFAULT_ASSISTANT_LIMITS[k];
  };
  return { userPerDay: pick("userPerDay"), globalPerDay: pick("globalPerDay") };
}

export const REQUEST_LIMITS = { messages: 12, messageChars: 2000, selections: 60 } as const;

export interface AssistantRequest {
  venueId: string;
  plan: PlanSnapshot;
  messages: Array<{ role: "user" | "model"; text: string }>;
  locale: string;
  estimateTotalCents: number | null;
}

export interface AssistantResult {
  reply: string;
  proposal: Proposal | null;
  demo: boolean;
  remainingToday: number;
}

const bad = (msg: string) => new HttpsError("invalid-argument", msg);

/** Checks the request's shape and sizes; contents are checked against real data later. */
export function parseAssistantRequest(data: unknown): AssistantRequest {
  const d = (data ?? {}) as Record<string, unknown>;
  if (typeof d.venueId !== "string" || !d.venueId || d.venueId.length > 128) throw bad("Missing venue.");
  const p = (d.plan ?? {}) as Record<string, unknown>;
  const headcount = Number(p.headcount);
  if (!Number.isInteger(headcount) || headcount < 0 || headcount > 7000) throw bad("Invalid plan.");
  const selections: Record<string, number> = {};
  if (p.selections && typeof p.selections === "object") {
    const entries = Object.entries(p.selections as Record<string, unknown>);
    if (entries.length > REQUEST_LIMITS.selections) throw bad("Too many selections.");
    for (const [k, v] of entries) if (typeof k === "string" && k.length <= 300 && Number.isInteger(v)) selections[k] = v as number;
  }
  const tier = p.tierKey;
  const plan: PlanSnapshot = {
    headcount,
    spaceId: typeof p.spaceId === "string" ? p.spaceId : null,
    tierKey: tier === "standard" || tier === "peak" || tier === "offPeak" ? (tier as TierKey) : null,
    themeId: typeof p.themeId === "string" && THEMES.some((t) => t.id === p.themeId) ? p.themeId : THEMES[0]!.id,
    weddingDate: typeof p.weddingDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.weddingDate) ? p.weddingDate : null,
    selections,
  };
  if (!Array.isArray(d.messages) || d.messages.length === 0 || d.messages.length > REQUEST_LIMITS.messages) throw bad("Invalid conversation.");
  const messages = d.messages.map((m) => {
    const x = (m ?? {}) as Record<string, unknown>;
    if ((x.role !== "user" && x.role !== "model") || typeof x.text !== "string" || !x.text.trim() || x.text.length > REQUEST_LIMITS.messageChars) throw bad("Invalid message.");
    return { role: x.role, text: x.text } as AssistantRequest["messages"][number];
  });
  if (messages[messages.length - 1]!.role !== "user") throw bad("The last message must be yours.");
  const locale = typeof d.locale === "string" && ["en", "zh", "ms", "ta"].includes(d.locale) ? d.locale : "en";
  const est = Number(d.estimateTotalCents);
  return { venueId: d.venueId, plan, messages, locale, estimateTotalCents: Number.isSafeInteger(est) && est >= 0 ? est : null };
}

/**
 * What the assistant may suggest: the venue's rooms, and active items and
 * packages from the venue and from listed decorators who work there, plus
 * vendors the plan already uses (so their items stay understood).
 */
export async function loadVenueContext(db: Firestore, venueId: string, plan: PlanSnapshot): Promise<VenueContext> {
  const venueSnap = await db.doc(`venues/${venueId}`).get();
  const venue = venueSnap.data();
  if (!venue || venue.status !== "active") throw new HttpsError("not-found", "This venue isn't available.");
  const spacesSnap = await venueSnap.ref.collection("spaces").orderBy("sortOrder").get();
  const spaces: ContextSpace[] = spacesSnap.docs.map((s) => {
    const d = s.data();
    const tiers = (d.tiers ?? {}) as ContextSpace["tiers"];
    return { id: s.id, name: String(d.name ?? ""), capacityMin: Number(d.capacityMin), capacityMax: Number(d.capacityMax), seatsPerTable: Number(d.seatsPerTable ?? 10), tiers };
  });

  const decorators = await db.collection("vendors").where("published", "==", true).where("listed", "==", true).where("kinds", "array-contains", "decorator").get();
  const serving = decorators.docs
    .filter((d) => d.id !== venue.ownerUid && (d.get("servesAnyVenue") === true || ((d.get("servesVenueIds") as string[] | undefined) ?? []).includes(venueId)))
    .map((d) => d.id);
  const planVendors = Object.keys(plan.selections)
    .map((k) => k.split(":")[1])
    .filter((u): u is string => !!u);
  const vendorUids = [...new Set([venue.ownerUid as string, ...serving, ...planVendors])].slice(0, 20);

  const options: ContextOption[] = [];
  for (const uid of vendorUids) {
    const vendor = await db.doc(`vendors/${uid}`).get();
    if (!vendor.exists || vendor.get("published") !== true) continue;
    const vendorName = String(vendor.get("businessName") ?? "");
    const [items, packages] = await Promise.all([
      vendor.ref.collection("items").where("active", "==", true).get(),
      vendor.ref.collection("packages").where("active", "==", true).get(),
    ]);
    for (const i of items.docs) {
      const d = i.data();
      options.push({ key: `item:${uid}:${i.id}`, vendorName, name: String(d.name), category: String(d.category), unit: d.unit, priceCents: Number(d.priceCents), dietaryTags: (d.dietaryTags as string[] | undefined) ?? [], includes: [] });
    }
    for (const p of packages.docs) {
      const d = p.data();
      options.push({
        key: `package:${uid}:${p.id}`,
        vendorName,
        name: `${String(d.name)} (package)`,
        category: "Package",
        unit: d.unit,
        priceCents: Number(d.priceCents),
        dietaryTags: [],
        includes: ((d.itemIds as string[] | undefined) ?? []).map((id) => `item:${uid}:${id}`),
      });
    }
  }
  return { venueId, venueName: String(venue.name ?? ""), spaces, options: options.slice(0, 200) };
}

export const PROPOSE_FUNCTION: FunctionDeclaration = {
  name: "propose_plan_changes",
  description:
    "Suggest changes to the couple's plan. Include only fields that should change. The couple reviews the suggestion and taps Apply; nothing changes until then.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "One sentence, in the couple's language, describing the suggested change and why." },
      headcount: { type: Type.INTEGER, description: "New number of guests." },
      spaceId: { type: Type.STRING, description: "Room id from VENUE DATA." },
      tierKey: { type: Type.STRING, enum: ["standard", "peak", "offPeak"], description: "Pricing tier offered by the chosen room." },
      themeId: { type: Type.STRING, enum: THEMES.map((t) => t.id), description: "Theme id." },
      weddingDate: { type: Type.STRING, description: "YYYY-MM-DD, or empty string to clear." },
      add: {
        type: Type.ARRAY,
        description: "Choices to add or re-quantify, by exact key from VENUE DATA.",
        items: { type: Type.OBJECT, properties: { ref: { type: Type.STRING }, quantity: { type: Type.INTEGER } }, required: ["ref"] },
      },
      remove: { type: Type.ARRAY, description: "Keys of currently chosen items or packages to remove.", items: { type: Type.STRING } },
    },
    required: ["summary"],
  },
};

const FRIENDLY_FAILURE = "The planning assistant couldn't answer just now. Please try again in a moment.";
const BLOCKED = "I can't help with that request. I can help you plan guests, rooms, themes, decor, food and budget for your wedding.";

/** One chat turn. The model may answer in text and/or propose plan changes; proposals are validated. */
async function askGemini(apiKey: string, req: AssistantRequest, ctx: VenueContext): Promise<{ text: string; args: Record<string, unknown> | null }> {
  const ai = new GoogleGenAI({ apiKey });
  const contents = [
    { role: "user", parts: [{ text: venueDataBlock(ctx, req.plan, req.estimateTotalCents) }] },
    { role: "model", parts: [{ text: "Understood. I'll use only this data." }] },
    ...req.messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
  ];
  let response;
  try {
    response = await ai.models.generateContent({
      model: ASSISTANT_MODEL,
      contents,
      config: {
        systemInstruction: systemInstruction(req.locale),
        tools: [{ functionDeclarations: [PROPOSE_FUNCTION] }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        maxOutputTokens: 800,
      },
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 0;
    if (status === 400 && /safety|blocked|prohibited/i.test(String((err as Error).message))) return { text: BLOCKED, args: null };
    throw new HttpsError("unavailable", FRIENDLY_FAILURE);
  }
  if (response.promptFeedback?.blockReason || response.candidates?.[0]?.finishReason === "SAFETY") return { text: BLOCKED, args: null };
  const call = response.functionCalls?.find((c) => c.name === PROPOSE_FUNCTION.name);
  const text = (response.text ?? "").trim();
  return { text, args: (call?.args as Record<string, unknown> | undefined) ?? null };
}

export interface AssistantDeps {
  db: Firestore;
  apiKey: string | null;
  now: () => Date;
  /** Injected in tests; defaults to the real Gemini call. */
  ask?: typeof askGemini;
}

/**
 * Reserve one message from today's allowance (refunded if the model call
 * fails), answer, and return a checked proposal the couple may apply.
 */
export async function handleAssistantRequest(uid: string, req: AssistantRequest, deps: AssistantDeps): Promise<AssistantResult> {
  const { db } = deps;
  const ctx = await loadVenueContext(db, req.venueId, req.plan);

  const now = deps.now();
  const { day } = periodKeys(now);
  const limits = resolveAssistantLimits((await db.doc("config/assistantLimits").get()).data());
  const userRef = db.doc(`usage/chat_user_${uid}_${day}`);
  const globalRef = db.doc(`usage/chat_global_${day}`);
  const used = await db.runTransaction(async (tx) => {
    const [u, g] = await Promise.all([tx.get(userRef), tx.get(globalRef)]);
    const uCount = (u.get("count") as number | undefined) ?? 0;
    const gCount = (g.get("count") as number | undefined) ?? 0;
    if (uCount >= limits.userPerDay) throw new HttpsError("resource-exhausted", "You've used today's planning assistant messages. You can ask again tomorrow; your plan is saved.");
    if (gCount >= limits.globalPerDay) throw new HttpsError("resource-exhausted", "The planning assistant is very busy today. Please try again tomorrow.");
    tx.set(userRef, { subject: uid, kind: "chat", period: day, count: FieldValue.increment(1) }, { merge: true });
    tx.set(globalRef, { subject: "global", kind: "chat", period: day, count: FieldValue.increment(1) }, { merge: true });
    return uCount + 1;
  });

  const demo = !deps.apiKey;
  let answer: { text: string; args: Record<string, unknown> | null };
  try {
    answer = demo ? demoReply(req.messages[req.messages.length - 1]!.text, ctx, req.plan) : await (deps.ask ?? askGemini)(deps.apiKey!, req, ctx);
  } catch (err) {
    // A failed answer doesn't use up the allowance.
    await Promise.all([userRef.set({ count: FieldValue.increment(-1) }, { merge: true }), globalRef.set({ count: FieldValue.increment(-1) }, { merge: true })]);
    throw err instanceof HttpsError ? err : new HttpsError("unavailable", FRIENDLY_FAILURE);
  }

  const proposal = answer.args ? validateProposal(answer.args, ctx, req.plan) : null;
  const usable = proposal && proposal.changes.length ? proposal : null;
  const reply = answer.text || usable?.summary || "Here's what I suggest.";
  return { reply, proposal: usable, demo, remainingToday: Math.max(0, limits.userPerDay - used) };
}
