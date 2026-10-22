"use client";

import { CalendarCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { answerBooking, type BookingRow } from "@/lib/data/billing";
import { useLocale } from "@/lib/i18n/provider";
import { formatSGD } from "@/lib/money";

/** Under a confirmed vendor: the vendor's booking claim and the couple's yes or no. */
export function BookingAnswer({ booking, vendorName }: { booking: BookingRow; vendorName: string }) {
  const { t, date } = useLocale();
  const toast = useToast();
  const [busy, setBusy] = useState<"confirmed" | "disputed" | null>(null);
  const when = date(new Date(`${booking.eventDate}T12:00:00+08:00`).getTime(), { day: "numeric", month: "long", year: "numeric" });

  async function answer(a: "confirmed" | "disputed") {
    setBusy(a);
    try {
      await answerBooking(booking.leadId, a);
      toast({ title: t("booking.thanks"), tone: "success" });
    } catch {
      toast({ title: t("booking.failed"), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (booking.status === "confirmed")
    return (
      <p className="flex items-center gap-2 text-small font-semibold text-success">
        <CalendarCheck aria-hidden className="size-4" />
        {t("booking.confirmed", { vendor: vendorName, date: when })}
      </p>
    );
  if (booking.status === "disputed") return <p className="text-small text-muted">{t("booking.disputed", { vendor: vendorName })}</p>;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-subtle p-3">
      <p className="text-small">
        {booking.valueCents === null
          ? t("booking.claimed", { vendor: vendorName, date: when })
          : t("booking.claimedValue", { vendor: vendorName, date: when, amount: formatSGD(booking.valueCents) })}{" "}
        <span className="font-semibold">{t("booking.question")}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => answer("confirmed")} loading={busy === "confirmed"} disabled={busy !== null}>
          {t("booking.yes")}
        </Button>
        <Button variant="ghost" onClick={() => answer("disputed")} loading={busy === "disputed"} disabled={busy !== null}>
          {t("booking.no")}
        </Button>
      </div>
      <p className="text-small text-muted">{t("booking.why")}</p>
    </div>
  );
}
