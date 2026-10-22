"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { createVendor, type BusinessInput } from "@/lib/data/vendors";
import { validateBusinessProfile } from "@/lib/vendors/model";
import { BusinessFields } from "./business-fields";

/** First visit to the vendor area: venue, decorator, or both. */
export function BusinessSetup({ uid }: { uid: string }) {
  const [value, setValue] = useState<BusinessInput>({ kinds: [], businessName: "", description: "" });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const input = { ...value, businessName: value.businessName.trim() };
    const e = validateBusinessProfile({ ...input, servesAnyVenue: true, servesVenueIds: [] });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      // The vendor area re-renders with the new profile automatically.
      await createVendor(uid, input);
    } catch {
      setErrors({ form: "We couldn't save that. Please try again." });
      setBusy(false);
    }
  }

  return (
    <main className="container-page flex flex-col gap-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">Set up your business</h1>
        <p className="max-w-2xl text-muted">Tell couples who you are. You can change all of this later.</p>
      </div>
      <Card>
        <CardBody>
          <form onSubmit={submit} noValidate className="flex flex-col gap-6">
            <BusinessFields value={value} onChange={setValue} errors={errors} />
            {errors.form && (
              <p role="alert" className="text-small font-medium text-error">
                {errors.form}
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" loading={busy} className="self-start">
              Continue
            </Button>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}
