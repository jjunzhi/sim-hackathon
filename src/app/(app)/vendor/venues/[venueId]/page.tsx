"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CircleCheck, Circle } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { PhotoPicker } from "@/components/photos/photo-picker";
import { SpacesEditor } from "@/components/vendor/spaces-editor";
import { TaxForm } from "@/components/vendor/tax-form";
import { VenueDetailsForm } from "@/components/vendor/venue-details-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { JourneyStepper } from "@/components/ui/journey-stepper";
import { SkeletonList } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { updateVenue, uploadCoverPhoto, watchSpaces, watchVenue, type WithId } from "@/lib/data/venues";
import { stepVariants } from "@/lib/motion";
import type { Space, Venue } from "@/lib/venues/model";
import { canPublish, publishChecklist } from "@/lib/venues/publish";

const STEPS = [
  { id: "details", label: "Details" },
  { id: "spaces", label: "Spaces and prices" },
  { id: "tax", label: "Tax" },
  { id: "publish", label: "Publish" },
];

export default function VenueEditorPage() {
  return (
    <Suspense>
      <VenueEditor />
    </Suspense>
  );
}

function VenueEditor() {
  const { venueId } = useParams<{ venueId: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const [venue, setVenue] = useState<WithId<Venue> | null | undefined>(undefined);
  const [spaces, setSpaces] = useState<WithId<Space>[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.id === params.get("step")));
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const onErr = () => setError("We couldn't load this venue. It may have been removed, or you may not have access.");
    const a = watchVenue(venueId, setVenue, onErr);
    const b = watchSpaces(venueId, setSpaces, onErr);
    return () => {
      a();
      b();
    };
  }, [venueId]);

  function goTo(i: number) {
    setDirection(i >= stepIndex ? 1 : -1);
    router.replace(`/vendor/venues/${venueId}?step=${STEPS[i]!.id}`, { scroll: false });
    window.scrollTo({ top: 0 });
  }

  if (error || venue === null) {
    return (
      <main className="container-page py-10">
        <p role="alert" className="text-error">
          {error ?? "This venue doesn't exist."}
        </p>
      </main>
    );
  }
  if (venue === undefined || spaces === null) {
    return (
      <main className="container-page py-10">
        <SkeletonList rows={3} label="Loading venue" />
      </main>
    );
  }

  const checks = publishChecklist(venue, spaces);

  return (
    <main className="container-page flex flex-col gap-8 py-10 pb-28 sm:pb-10">
      <div className="flex flex-col gap-3">
        <Link href="/vendor" className="inline-flex min-h-11 w-fit items-center gap-2 text-small font-semibold text-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-4" />
          Your venues
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h1">{venue.name}</h1>
          {venue.status === "active" ? <Badge tone="confirmed">Published</Badge> : <Badge tone="neutral">Draft</Badge>}
          {venue.verified && <Badge tone="confirmed">Verified</Badge>}
        </div>
      </div>

      <JourneyStepper steps={STEPS} current={stepIndex} onStepChange={goTo} allowForward label="Venue setup steps" />

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.section
          key={stepIndex}
          custom={direction}
          variants={stepVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          aria-labelledby="step-title"
          className="flex flex-col gap-6"
        >
          <h2 id="step-title" className="text-h2">
            {STEPS[stepIndex]!.label}
          </h2>

          {stepIndex === 0 && (
            <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
              <Card>
                <CardBody>
                  <VenueDetailsForm
                    initial={venue}
                    submitLabel="Save details"
                    onSave={async (values) => {
                      await updateVenue(venue.id, values);
                      toast({ title: "Details saved", tone: "success" });
                    }}
                  />
                </CardBody>
              </Card>
              <Card className="self-start">
                <CardBody>
                  <PhotoPicker
                    label="Cover photo"
                    photo={venue.coverPhoto}
                    alt={`${venue.name}, cover photo`}
                    upload={(image, onProgress) => uploadCoverPhoto(venue, image, onProgress)}
                  />
                </CardBody>
              </Card>
            </div>
          )}

          {stepIndex === 1 && <SpacesEditor venueId={venue.id} spaces={spaces} />}

          {stepIndex === 2 && (
            <Card>
              <CardBody>
                <TaxForm venueId={venue.id} initial={venue.tax} />
              </CardBody>
            </Card>
          )}

          {stepIndex === 3 && <PublishPanel venue={venue} checks={checks} />}
        </motion.section>
      </AnimatePresence>

      {/* Mobile step navigation: the stepper is compact there, so offer explicit back/next. */}
      <nav
        aria-label="Step navigation"
        className="fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
      >
        <Button className="flex-1" onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0}>
          Back
        </Button>
        <Button className="flex-1" onClick={() => goTo(stepIndex + 1)} disabled={stepIndex === STEPS.length - 1}>
          Next
        </Button>
      </nav>
    </main>
  );
}

function PublishPanel({ venue, checks }: { venue: WithId<Venue>; checks: ReturnType<typeof publishChecklist> }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const ready = canPublish(checks);
  const published = venue.status === "active";

  async function setStatus(status: "draft" | "active") {
    setBusy(true);
    try {
      await updateVenue(venue.id, { status });
      toast({
        title: status === "active" ? "Venue published" : "Venue unpublished",
        description: status === "active" ? "Couples can now find it." : "It's hidden from couples until you publish again.",
        tone: "success",
      });
    } catch {
      toast({ title: "We couldn't change that. Please try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-6">
        <ul className="flex flex-col gap-3">
          {checks.map((c) => (
            <li key={c.id} className="flex items-center gap-3">
              {c.done ? <CircleCheck aria-hidden className="size-5 text-success" /> : <Circle aria-hidden className="size-5 text-muted" />}
              <span className={c.done ? "text-ink" : "text-muted"}>{c.label}</span>
              <span className="sr-only">{c.done ? "(done)" : "(not done yet)"}</span>
            </li>
          ))}
        </ul>
        <p className="max-w-2xl text-small text-muted">
          The &quot;Verified&quot; badge is added by the WeddingVista team after checking your listing. You can&apos;t add it yourself.
        </p>
        {published ? (
          <Button onClick={() => setStatus("draft")} loading={busy} className="self-start">
            Unpublish
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setStatus("active")} disabled={!ready} loading={busy} className="self-start">
            Publish venue
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
