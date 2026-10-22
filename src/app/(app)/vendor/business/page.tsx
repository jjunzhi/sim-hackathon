"use client";

import { Circle, CircleCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { BusinessFields } from "@/components/vendor/business-fields";
import { TaxForm } from "@/components/vendor/tax-form";
import { cn } from "@/lib/cn";
import { updateVendor, watchItems, type BusinessInput } from "@/lib/data/vendors";
import { watchMyVenues, watchPublishedVenues, type WithId } from "@/lib/data/venues";
import type { InventoryItem } from "@/lib/inventory/model";
import type { Venue } from "@/lib/venues/model";
import { validateBusinessProfile, type VendorProfile } from "@/lib/vendors/model";
import { useVendor } from "@/lib/vendors/vendor-context";

export default function BusinessPage() {
  const vendor = useVendor();
  if (vendor.status !== "ready") return null;
  return <Business uid={vendor.uid} profile={vendor.profile} />;
}

function Business({ uid, profile }: { uid: string; profile: VendorProfile }) {
  return (
    <main className="container-page flex flex-col gap-8 py-10">
      <h1 className="text-h1">Business</h1>
      <Section title="Details">
        <DetailsForm uid={uid} profile={profile} />
      </Section>
      <Section title="Tax" intro="Applies to every venue, item and package you list.">
        <TaxForm initial={profile.tax} onSave={(tax) => updateVendor(uid, { tax })} />
      </Section>
      {profile.kinds.includes("decorator") && (
        <Section title="Where you work" intro="Couples at these venues will see your items.">
          <ServedVenues uid={uid} profile={profile} />
        </Section>
      )}
      <Section title="Publish" intro="Couples see your active items only once your business is published.">
        <PublishBusiness uid={uid} profile={profile} />
      </Section>
    </main>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-h3">{title}</h2>
          {intro && <p className="text-small text-muted">{intro}</p>}
        </div>
        {children}
      </CardBody>
    </Card>
  );
}

function DetailsForm({ uid, profile }: { uid: string; profile: VendorProfile }) {
  const [value, setValue] = useState<BusinessInput>({ kinds: profile.kinds, businessName: profile.businessName, description: profile.description });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    const input = { ...value, businessName: value.businessName.trim() };
    const e = validateBusinessProfile({ ...input, servesAnyVenue: profile.servesAnyVenue, servesVenueIds: profile.servesVenueIds });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await updateVendor(uid, input);
      toast({ title: "Details saved", tone: "success" });
    } catch {
      setErrors({ form: "We couldn't save that. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-6">
      <BusinessFields value={value} onChange={setValue} errors={errors} />
      {errors.form && (
        <p role="alert" className="text-small font-medium text-error">
          {errors.form}
        </p>
      )}
      <Button type="submit" loading={busy} className="self-start">
        Save details
      </Button>
    </form>
  );
}

function ServedVenues({ uid, profile }: { uid: string; profile: VendorProfile }) {
  const [any, setAny] = useState(profile.servesAnyVenue);
  const [chosen, setChosen] = useState<string[]>(profile.servesVenueIds);
  const [venues, setVenues] = useState<WithId<Venue>[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => watchPublishedVenues(setVenues, () => setError("We couldn't load venues.")), []);

  async function save() {
    if (!any && chosen.length === 0) {
      setError("Choose at least one venue, or choose any venue.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateVendor(uid, { servesAnyVenue: any, servesVenueIds: any ? [] : chosen });
      toast({ title: "Venues saved", tone: "success" });
    } catch {
      setError("We couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="Venues you work at" className="grid gap-3 sm:grid-cols-2">
        {(
          [
            [true, "Any venue", "Couples at every published venue can choose your items."],
            [false, "Only venues I choose", "Pick the venues you can deliver to."],
          ] as const
        ).map(([value, label, body]) => (
          <label
            key={label}
            className={cn(
              "flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-xl border p-4 transition-colors",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              any === value ? "border-accent bg-accent-tint" : "border-line-strong bg-surface hover:bg-subtle",
            )}
          >
            <input type="radio" name="serves" checked={any === value} onChange={() => setAny(value)} className="sr-only" />
            <span className="font-semibold text-ink">{label}</span>
            <span className="text-small text-muted">{body}</span>
          </label>
        ))}
      </div>
      {!any && (
        <fieldset className="flex flex-col">
          <legend className="mb-2 text-small font-semibold text-ink">Published venues</legend>
          {venues === null && <p className="text-small text-muted">Loading venues...</p>}
          {venues?.length === 0 && <p className="text-small text-muted">No venues are published yet.</p>}
          {venues?.map((v) => (
            <Checkbox
              key={v.id}
              label={v.name}
              description={v.address}
              checked={chosen.includes(v.id)}
              onCheckedChange={(c) => setChosen((prev) => (c ? [...prev, v.id] : prev.filter((x) => x !== v.id)))}
            />
          ))}
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-small font-medium text-error">
          {error}
        </p>
      )}
      <Button onClick={save} loading={busy} className="self-start">
        Save venues
      </Button>
    </div>
  );
}

function PublishBusiness({ uid, profile }: { uid: string; profile: VendorProfile }) {
  const [items, setItems] = useState<WithId<InventoryItem>[] | null>(null);
  const [venues, setVenues] = useState<WithId<Venue>[] | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const a = watchItems(uid, setItems, () => setItems([]));
    const b = watchMyVenues(uid, setVenues, () => setVenues([]));
    return () => {
      a();
      b();
    };
  }, [uid]);

  const hasItem = (items ?? []).some((i) => i.active && i.photo);
  const hasVenue = (venues ?? []).some((v) => v.status === "active");
  const ready = hasItem || hasVenue;

  async function set(published: boolean) {
    setBusy(true);
    try {
      await updateVendor(uid, { published });
      toast({ title: published ? "Business published" : "Business unpublished", tone: "success" });
    } catch {
      toast({ title: "We couldn't change that. Please try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-3">
        {ready ? <CircleCheck aria-hidden className="size-5 text-success" /> : <Circle aria-hidden className="size-5 text-muted" />}
        <span className={ready ? "text-ink" : "text-muted"}>At least one active item with a photo, or a published venue</span>
        <span className="sr-only">{ready ? "(done)" : "(not done yet)"}</span>
      </p>
      {profile.published ? (
        <Button onClick={() => set(false)} loading={busy} className="self-start">
          Unpublish business
        </Button>
      ) : (
        <Button variant="primary" onClick={() => set(true)} disabled={!ready} loading={busy} className="self-start">
          Publish business
        </Button>
      )}
    </div>
  );
}
