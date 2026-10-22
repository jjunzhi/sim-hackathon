import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { FunctionCallingConfigMode, GoogleGenAI, Type, type FunctionDeclaration } from "@google/genai";
import { HttpsError } from "firebase-functions/https";
import { periodKeys } from "../render/quota.js";
import { THEMES } from "../render/themes.js";
import { demoReply } from "./demo.js";
import { ASSISTANT_MODEL, systemInstruction, venueDataBlock, type GuestCounts, type PlanFacts } from "./prompt.js";
import {
  cleanTimeline,
  LIMITS,
  validateProposal,
  validateShortlist,
  type ContextOption,
  type ContextSpace,
  type ContextVenue,
  type PlanSnapshot,
  type Proposal,
  type ShortlistEntry,
  type TierKey,
  type VenueContext,
} from "./proposal.js";
import { BRIEF_LIMITS, BRIEF_DIET_TAGS, BRIEF_TRADITIONS, type Brief } from "./types.js";

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

export const REQUEST_LIMITS = { messages: 12, messageChars: 2000, selections: 60, shortlistVenues: 40 } as const;

export interface AssistantRequest {
  venueId: string;
  plan: PlanSnapshot;
  messages: Array<{ role: "user" | "model"; text: string }>;
  locale: string;
  estimateTotalCents: number | null;
}

export interface AssistantResult {
  reply: string;
  /** One suggestion, or two or three labelled options. Every change is checked. */
  proposals: Proposal[];
  shortlist: ShortlistEntry[];
  /** Aria suggests asking a vendor to confirm prices; the couple sends it. */
  offerRequest: boolean;
  demo: boolean;
  remainingToday: number;
}

const bad = (msg: string) => new HttpsError("invalid-argument", msg);

/** The brief as sent by the client, cleaned to the same shape the rules allow. */
function parseBrief(raw: unknown): Brief | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const list = (v: unknown, allowed: readonly string[]) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.includes(x)))] : []);
  return {
    style: typeof b.style === "string" ? b.style.slice(0, BRIEF_LIMITS.styleMax) : "",
    traditions: list(b.traditions, BRIEF_TRADITIONS),
    dietaryTags: list(b.dietaryTags, BRIEF_DIET_TAGS),
    stepFree: b.stepFree === true,
    notes: typeof b.notes === "string" ? b.notes.slice(0, BRIEF_LIMITS.notesMax) : "",
  };
}

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
  const budget = Number(p.budgetCents);
  const plan: PlanSnapshot = {
    headcount,
    spaceId: typeof p.spaceId === "string" ? p.spaceId : null,
    tierKey: tier === "standard" || tier === "peak" || tier === "offPeak" ? (tier as TierKey) : null,
    themeId: typeof p.themeId === "string" && THEMES.some((t) => t.id === p.themeId) ? p.themeId : THEMES[0]!.id,
    weddingDate: typeof p.weddingDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.weddingDate) ? p.weddingDate : null,
    selections,
    budgetCents: p.budgetCents !== null && Number.isSafeInteger(budget) && budget >= 100 && budget <= BRIEF_LIMITS.budgetMaxCents ? budget : null,
    brief: parseBrief(p.brief),
    timeline: Array.isArray(p.timeline) ? cleanTimeline(p.timeline.slice(0, BRIEF_LIMITS.timelineEntries), []) : [],
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
 * What Aria may suggest: the venue's rooms, and active items and packages
 * from the venue and from listed decorators who work there, plus vendors the
 * plan already uses (so their items stay understood), and other listed
 * venues for shortlists.
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

  // Other venues a couple can find in the catalog (active and listed), for shortlists.
  const listed = await db.collection("venues").where("status", "==", "active").where("listed", "==", true).limit(REQUEST_LIMITS.shortlistVenues + 1).get();
  const venues: ContextVenue[] = listed.docs
    .filter((v) => v.id !== venueId)
    .slice(0, REQUEST_LIMITS.shortlistVenues)
    .map((v) => {
      const d = v.data();
      const cap = (d.capacitySummary ?? null) as { ranges?: Array<{ min: number; max: number }>; fromRentalCents?: number | null } | null;
      return {
        id: v.id,
        name: String(d.name ?? ""),
        styleTags: (d.styleTags as string[] | undefined) ?? [],
        cultureTags: (d.cultureTags as string[] | undefined) ?? [],
        menuOptions: (d.menuOptions as string[] | undefined) ?? [],
        stepFree: d.stepFreeEntrance === true,
        ranges: cap?.ranges ?? [],
        fromRentalCents: cap?.fromRentalCents ?? null,
      };
    });

  return { venueId, venueName: String(venue.name ?? ""), spaces, options: options.slice(0, 200), venues };
}

/** Seat counts by the couple's own tiers. Labels are never read into the prompt. */
export async function loadGuestCounts(db: Firestore, uid: string): Promise<GuestCounts | null> {
  const parties = await db.collection(`guestLists/${uid}/parties`).select("tier", "seats", "plusOnes").get();
  if (parties.empty) return null;
  const byTier: GuestCounts["byTier"] = { must: 0, extended: 0, close: 0, casual: 0 };
  for (const p of parties.docs) {
    const tier = p.get("tier") as keyof GuestCounts["byTier"];
    if (tier in byTier) byTier[tier] += Number(p.get("seats") ?? 0) + Number(p.get("plusOnes") ?? 0);
  }
  return { total: byTier.must + byTier.extended + byTier.close + byTier.casual, byTier };
}

/** Names of the plan's vendors who have marked the wedding date as unavailable. */
export async function loadUnavailable(db: Firestore, plan: PlanSnapshot, venueOwnerUid: string): Promise<string[]> {
  if (!plan.weddingDate) return [];
  const uids = [...new Set([venueOwnerUid, ...Object.keys(plan.selections).map((k) => k.split(":")[1]).filter((u): u is string => !!u)])].slice(0, 10);
  const out: string[] = [];
  for (const uid of uids) {
    const hit = await db.collection(`vendors/${uid}/blockedDates`).where("date", "==", plan.weddingDate).limit(1).get();
    if (!hit.empty) out.push(String((await db.doc(`vendors/${uid}`).get()).get("businessName") ?? "A vendor"));
  }
  return out;
}

const BRIEF_PARAMS = {
  budget: { type: Type.INTEGER, description: "The couple's total budget in whole Singapore dollars." },
  style: { type: Type.STRING, description: "The couple's style in a few words, as they describe it." },
  traditions: { type: Type.ARRAY, items: { type: Type.STRING, enum: [...BRIEF_TRADITIONS] }, description: "Traditions the couple mentioned." },
  dietaryTags: { type: Type.ARRAY, items: { type: Type.STRING, enum: [...BRIEF_DIET_TAGS] }, description: "Food needs the menus must cover." },
  stepFree: { type: Type.BOOLEAN, description: "True if step-free access is needed." },
  notes: { type: Type.STRING, description: "Other constraints the couple shared, briefly. No names or contact details." },
};

export const PROPOSE_FUNCTION: FunctionDeclaration = {
  name: "propose_plan_changes",
  description:
    "Suggest changes to the couple's plan. Include only fields that should change. The couple reviews the suggestion and taps Apply; nothing changes until then. Call up to three times with labels to offer options.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      label: { type: Type.STRING, description: 'Short option name such as "Option A" when offering several options; omit for a single suggestion.' },
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
      ...BRIEF_PARAMS,
      timeline: {
        type: Type.ARRAY,
        description: "A full day-of timeline draft, replacing the current one. Up to 15 entries.",
        items: { type: Type.OBJECT, properties: { time: { type: Type.STRING, description: "HH:MM, 24-hour" }, label: { type: Type.STRING } }, required: ["time", "label"] },
      },
    },
    required: ["summary"],
  },
};

export const SHORTLIST_FUNCTION: FunctionDeclaration = {
  name: "shortlist_venues",
  description: "Suggest up to 8 other listed venues from OTHER VENUES that fit the couple's needs, each with a short reason.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      venues: {
        type: Type.ARRAY,
        items: { type: Type.OBJECT, properties: { venueId: { type: Type.STRING }, reason: { type: Type.STRING } }, required: ["venueId", "reason"] },
      },
    },
    required: ["venues"],
  },
};

export const REQUEST_FUNCTION: FunctionDeclaration = {
  name: "offer_confirmation_request",
  description: "Offer to open the request that asks this plan's vendors to confirm their prices. The couple reviews and sends it; you never send anything.",
  parameters: { type: Type.OBJECT, properties: { reason: { type: Type.STRING } } },
};

const FRIENDLY_FAILURE = "Aria couldn't answer just now. Please try again in a moment.";
const BLOCKED = "I can't help with that request. I can help you plan guests, rooms, themes, decor, food, budget and the day's timeline.";

export interface ModelAnswer {
  text: string;
  calls: Array<{ name: string; args: Record<string, unknown> }>;
}

/** One chat turn. The model may answer in text and/or call functions; every call is validated afterwards. */
async function askGemini(apiKey: string, req: AssistantRequest, ctx: VenueContext, facts: PlanFacts): Promise<ModelAnswer> {
  const ai = new GoogleGenAI({ apiKey });
  const contents = [
    { role: "user", parts: [{ text: venueDataBlock(ctx, req.plan, facts) }] },
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
        tools: [{ functionDeclarations: [PROPOSE_FUNCTION, SHORTLIST_FUNCTION, REQUEST_FUNCTION] }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        maxOutputTokens: 1500,
      },
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 0;
    if (status === 400 && /safety|blocked|prohibited/i.test(String((err as Error).message))) return { text: BLOCKED, calls: [] };
    throw new HttpsError("unavailable", FRIENDLY_FAILURE);
  }
  if (response.promptFeedback?.blockReason || response.candidates?.[0]?.finishReason === "SAFETY") return { text: BLOCKED, calls: [] };
  const calls = (response.functionCalls ?? []).map((c) => ({ name: c.name ?? "", args: (c.args as Record<string, unknown> | undefined) ?? {} }));
  return { text: (response.text ?? "").trim(), calls };
}

/** Turns the model's function calls into checked results. Unknown calls are ignored. */
export function checkCalls(calls: ModelAnswer["calls"], ctx: VenueContext, plan: PlanSnapshot): Pick<AssistantResult, "proposals" | "shortlist" | "offerRequest"> {
  const proposals = calls
    .filter((c) => c.name === PROPOSE_FUNCTION.name)
    .slice(0, LIMITS.optionsMax)
    .map((c) => validateProposal(c.args, ctx, plan))
    .filter((p) => p.changes.length > 0);
  // A single suggestion needs no "Option A" label.
  if (proposals.length === 1) proposals[0]!.label = "";
  const list = calls.find((c) => c.name === SHORTLIST_FUNCTION.name);
  return { proposals, shortlist: list ? validateShortlist(list.args, ctx) : [], offerRequest: calls.some((c) => c.name === REQUEST_FUNCTION.name) };
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
 * fails), answer, and return checked suggestions the couple may apply.
 */
export async function handleAssistantRequest(uid: string, req: AssistantRequest, deps: AssistantDeps): Promise<AssistantResult> {
  const { db } = deps;
  const ctx = await loadVenueContext(db, req.venueId, req.plan);
  const venueOwner = String((await db.doc(`venues/${req.venueId}`).get()).get("ownerUid") ?? "");
  const [guests, unavailable] = await Promise.all([loadGuestCounts(db, uid), loadUnavailable(db, req.plan, venueOwner)]);
  const facts: PlanFacts = { estimateTotalCents: req.estimateTotalCents, guests, unavailable };

  const now = deps.now();
  const { day } = periodKeys(now);
  const limits = resolveAssistantLimits((await db.doc("config/assistantLimits").get()).data());
  const userRef = db.doc(`usage/chat_user_${uid}_${day}`);
  const globalRef = db.doc(`usage/chat_global_${day}`);
  const used = await db.runTransaction(async (tx) => {
    const [u, g] = await Promise.all([tx.get(userRef), tx.get(globalRef)]);
    const uCount = (u.get("count") as number | undefined) ?? 0;
    const gCount = (g.get("count") as number | undefined) ?? 0;
    if (uCount >= limits.userPerDay) throw new HttpsError("resource-exhausted", "You've used today's messages with Aria. You can ask again tomorrow; your plan is saved.");
    if (gCount >= limits.globalPerDay) throw new HttpsError("resource-exhausted", "Aria is very busy today. Please try again tomorrow.");
    tx.set(userRef, { subject: uid, kind: "chat", period: day, count: FieldValue.increment(1) }, { merge: true });
    tx.set(globalRef, { subject: "global", kind: "chat", period: day, count: FieldValue.increment(1) }, { merge: true });
    return uCount + 1;
  });

  const demo = !deps.apiKey;
  let answer: ModelAnswer;
  try {
    answer = demo ? demoReply(req.messages[req.messages.length - 1]!.text, ctx, req.plan, facts) : await (deps.ask ?? askGemini)(deps.apiKey!, req, ctx, facts);
  } catch (err) {
    // A failed answer doesn't use up the allowance.
    await Promise.all([userRef.set({ count: FieldValue.increment(-1) }, { merge: true }), globalRef.set({ count: FieldValue.increment(-1) }, { merge: true })]);
    throw err instanceof HttpsError ? err : new HttpsError("unavailable", FRIENDLY_FAILURE);
  }

  const checked = checkCalls(answer.calls, ctx, req.plan);
  const reply = answer.text || checked.proposals[0]?.summary || (checked.shortlist.length ? "Here are some venues that could fit." : "Here's what I suggest.");
  return { reply, ...checked, demo, remainingToday: Math.max(0, limits.userPerDay - used) };
}
