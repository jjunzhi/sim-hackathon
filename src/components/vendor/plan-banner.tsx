"use client";

import Link from "next/link";
import { CircleAlert, Info } from "lucide-react";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import { useBilling } from "@/lib/billing/use-billing";
import { redeemInvite, takeStashedInvite } from "@/lib/data/billing";
import { formatDate } from "@/lib/i18n/format";
import { useVendor } from "@/lib/vendors/vendor-context";

const DAY = 24 * 60 * 60 * 1000;
const sgDay = (ms: number) => formatDate("en-SG", ms, { day: "numeric", month: "long", year: "numeric" });

/**
 * One line above every vendor screen when the plan needs attention: a failed
 * payment in its grace period, a pilot ending soon, or listings hidden.
 * Also redeems an invite link opened before sign-up.
 */
export function PlanBanner() {
  const vendor = useVendor();
  const uid = vendor.status === "ready" ? vendor.uid : null;
  const { standing, billing, nowMs } = useBilling(uid);
  const toast = useToast();
  const redeemed = useRef(false);

  useEffect(() => {
    if (!uid || redeemed.current) return;
    redeemed.current = true;
    const code = takeStashedInvite();
    if (!code) return;
    redeemInvite(code).then((r) =>
      toast(
        r.ok
          ? { title: "Pilot invite applied", description: `Your listing is free until ${sgDay(r.pilotUntilMs)}.`, tone: "success" }
          : { title: "We couldn't use that invite", description: "Check the code on the Plan page, or ask whoever invited you for a new link.", tone: "error" },
      ),
    );
  }, [uid, toast]);

  if (vendor.status !== "ready" || !standing || !billing) return null;
  const link = (
    <Link href="/vendor/billing" className="font-semibold underline underline-offset-4">
      Plan and billing
    </Link>
  );
  let tone: "warning" | "info" | null = null;
  let text = "";
  if (standing.kind === "grace") {
    tone = "warning";
    text = `Your last payment didn't go through. Your listings stay visible until ${sgDay(standing.untilMs)}. Update your card in`;
  } else if (standing.kind === "pilot" && standing.untilMs - nowMs < 14 * DAY) {
    tone = "info";
    text = `Your free pilot ends on ${sgDay(standing.untilMs)}. To stay listed after that, choose the monthly plan in`;
  } else if (standing.kind === "lapsed" && vendor.profile.published) {
    tone = "warning";
    const why =
      standing.reason === "pilot-ended" ? "your pilot has ended" : standing.reason === "payment-failed" ? "a payment didn't go through" : standing.reason === "canceled" ? "your plan was cancelled" : "you don't have a plan yet";
    text = `Couples can't find your listings because ${why}. Your data, leads and confirmations are kept. See`;
  }
  if (!tone) return null;
  const Icon = tone === "warning" ? CircleAlert : Info;
  return (
    <div role="status" className={tone === "warning" ? "border-b border-warning-icon bg-surface" : "border-b border-line bg-subtle"}>
      <p className="container-page flex items-start gap-2 py-3 text-small">
        <Icon aria-hidden className={tone === "warning" ? "mt-0.5 size-4 shrink-0 text-warning-icon" : "mt-0.5 size-4 shrink-0 text-muted"} />
        <span>
          {text} {link}.
        </span>
      </p>
    </div>
  );
}
