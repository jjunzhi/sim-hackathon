"use client";

import { CalendarCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { isIsoDate } from "@/lib/calendar/ics";
import { claimBooking, correctBooking, watchLeadBooking, withdrawBooking, type BookingRow } from "@/lib/data/billing";
import type { LeadRow } from "@/lib/data/leads";
import { formatDate } from "@/lib/i18n/format";
import { centsToInput, formatSGD, parseDollarsToCents } from "@/lib/money";

const sgDay = (iso: string) => formatDate("en-SG", new Date(`${iso}T12:00:00+08:00`).getTime(), { day: "numeric", month: "long", year: "numeric" });

/**
 * Platform-sourced bookings: once a confirmed lead books, the vendor records
 * it here and the couple is asked to confirm. Only confirmed bookings count.
 */
export function BookingCard({ lead }: { lead: LeadRow }) {
  const toast = useToast();
  const [booking, setBooking] = useState<BookingRow | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => watchLeadBooking(lead.vendorUid, lead.id, setBooking), [lead.vendorUid, lead.id]);
  if (lead.status !== "confirmed" || booking === undefined) return null;

  const coupleGone = lead.coupleUid === null;
  async function withdraw() {
    setBusy(true);
    await withdrawBooking(lead.id)
      .then(() => toast({ title: "Booking withdrawn" }))
      .catch(() => toast({ title: "We couldn't withdraw it. Please try again.", tone: "error" }));
    setBusy(false);
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-h3">Booking</h2>
          {booking?.status === "confirmed" && <Badge tone="confirmed">Booked</Badge>}
          {booking?.status === "claimed" && <Badge tone="warning">Waiting for the couple</Badge>}
          {booking?.status === "disputed" && <Badge tone="neutral">Not confirmed</Badge>}
        </div>
        {!booking && (
          <>
            <p className="text-small text-muted">
              {coupleGone ? "The couple deleted their account, so they can't confirm a booking." : "Did this couple book with you? Record it and they'll be asked to confirm."}
            </p>
            {!coupleGone && (
              <Button onClick={() => setEditing(true)} icon={<CalendarCheck aria-hidden className="size-4" />} className="self-start">
                Mark as booked
              </Button>
            )}
          </>
        )}
        {booking && (
          <dl className="num grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-small">
            <dt className="text-muted">Event date</dt>
            <dd>{sgDay(booking.eventDate)}</dd>
            <dt className="text-muted">Booked value</dt>
            <dd>{booking.valueCents === null ? "Not given" : formatSGD(booking.valueCents)}</dd>
          </dl>
        )}
        {booking?.status === "claimed" && <p className="text-small text-muted">The couple sees this and can confirm it or say it isn&apos;t right.</p>}
        {booking?.status === "disputed" && <p className="text-small">The couple said this isn&apos;t right. Check the details with them, then correct it to ask again.</p>}
        {booking?.status === "confirmed" && <p className="text-small text-muted">Confirmed by the couple. It counts on your Plan and billing statement.</p>}
        {booking && booking.status !== "confirmed" && (
          <div className="flex flex-wrap gap-2">
            {booking.status === "disputed" && <Button onClick={() => setEditing(true)}>Correct and ask again</Button>}
            <Button variant="ghost" onClick={withdraw} loading={busy}>
              Withdraw
            </Button>
          </div>
        )}
      </CardBody>
      {editing && <BookingModal lead={lead} existing={booking ?? null} onClose={() => setEditing(false)} />}
    </Card>
  );
}

function BookingModal({ lead, existing, onClose }: { lead: LeadRow; existing: BookingRow | null; onClose: () => void }) {
  const toast = useToast();
  const suggested = existing?.eventDate ?? (lead.contact?.eventDate && isIsoDate(lead.contact.eventDate) ? lead.contact.eventDate : "");
  const [date, setDate] = useState(suggested);
  const [value, setValue] = useState(existing?.valueCents != null ? centsToInput(existing.valueCents) : "");
  const [errors, setErrors] = useState<{ date?: string; value?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function save() {
    const e: typeof errors = {};
    if (!isIsoDate(date)) e.date = "Choose the event date.";
    const cents = value.trim() ? parseDollarsToCents(value) : null;
    if (value.trim() && cents === null) e.value = "Enter an amount, for example 54810.60, or leave it empty.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (existing) await correctBooking(lead.id, date, cents);
      else await claimBooking(lead, date, cents);
      toast({ title: "Booking recorded", description: "The couple has been asked to confirm it.", tone: "success" });
      onClose();
    } catch {
      setErrors({ form: "We couldn't save that. Please try again." });
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={existing ? "Correct the booking" : "Mark as booked"}
      description="Only for couples who booked with you after this request. The couple will be asked to confirm."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={save}>
            {existing ? "Save and ask again" : "Record booking"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Event date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
        <Input
          label="Booked value (optional)"
          prefix="S$"
          inputMode="decimal"
          className="num"
          hint="The total the couple agreed with you. Used only for your statement."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={errors.value}
        />
        {errors.form && (
          <p role="alert" className="text-small text-error">
            {errors.form}
          </p>
        )}
      </div>
    </Modal>
  );
}
