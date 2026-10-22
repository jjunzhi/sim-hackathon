"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { emptyVenueProfile, VenueDetailsForm } from "@/components/vendor/venue-details-form";
import { Card, CardBody } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/auth-provider";
import { createVenue } from "@/lib/data/venues";

export default function NewVenuePage() {
  const auth = useAuth();
  const router = useRouter();
  if (auth.status !== "ready") return null;
  const uid = auth.user.uid;

  return (
    <main className="container-page flex flex-col gap-6 py-10">
      <Link href="/vendor" className="inline-flex min-h-11 w-fit items-center gap-2 text-small font-semibold text-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Overview
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">Add a venue</h1>
        <p className="text-muted">Start with the basics. Spaces, prices and photos come next.</p>
      </div>
      <Card>
        <CardBody>
          <VenueDetailsForm
            initial={emptyVenueProfile}
            submitLabel="Save and continue"
            onSave={async (values) => {
              const id = await createVenue(uid, values);
              router.replace(`/vendor/venues/${id}?step=spaces`);
            }}
          />
        </CardBody>
      </Card>
    </main>
  );
}
