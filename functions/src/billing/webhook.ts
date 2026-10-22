import type { Firestore } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { syncListing } from "./listing.js";
import { applySubscription, readBilling } from "./standing.js";

/**
 * Applies one verified Stripe event. Only subscription snapshots change
 * access: Stripe sends customer.subscription.updated whenever the status
 * moves (trialing, active, past_due, unpaid, canceled), so invoice events
 * need no handling of their own. Events can arrive out of order or twice;
 * applySubscription ignores anything older than what was already applied.
 */
export async function handleStripeEvent(db: Firestore, event: Stripe.Event, nowMs: number): Promise<{ handled: boolean; uid?: string }> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const uid = s.client_reference_id;
      const customer = typeof s.customer === "string" ? s.customer : (s.customer?.id ?? null);
      if (!uid || !customer || s.mode !== "subscription") return { handled: false };
      // Links the Stripe customer to the vendor; the subscription events carry the status.
      await db.doc(`billing/${uid}`).set({ stripeCustomerId: customer, updatedAtMs: nowMs }, { merge: true });
      return { handled: true, uid };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const uid = sub.metadata?.uid || (await uidForCustomer(db, customer));
      if (!uid) return { handled: false };
      const ref = db.doc(`billing/${uid}`);
      const applied = await db.runTransaction(async (tx) => {
        const prev = readBilling((await tx.get(ref)).data());
        const next = applySubscription(
          prev,
          {
            id: sub.id,
            status: sub.status,
            customer,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            // Current API versions keep the period on each item, not on the subscription.
            currentPeriodEndMs: Math.max(0, ...sub.items.data.map((i) => i.current_period_end ?? 0)) * 1000 || null,
          },
          event.created * 1000,
          nowMs,
        );
        if (!next) return false;
        tx.set(ref, { ...next, updatedAtMs: nowMs }, { merge: true });
        return true;
      });
      if (applied) await syncListing(db, uid, nowMs);
      return { handled: applied, uid };
    }
    default:
      return { handled: false };
  }
}

async function uidForCustomer(db: Firestore, customer: string): Promise<string | null> {
  const q = await db.collection("billing").where("stripeCustomerId", "==", customer).limit(1).get();
  return q.docs[0]?.id ?? null;
}

/** Records an event id; false if it was already processed. */
export async function markProcessed(db: Firestore, eventId: string, type: string, nowMs: number): Promise<boolean> {
  try {
    await db.doc(`stripeEvents/${eventId}`).create({ type, receivedAtMs: nowMs });
    return true;
  } catch {
    return false;
  }
}
