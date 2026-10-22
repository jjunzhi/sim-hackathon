"use client";

import { AnimatePresence, motion } from "motion/react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { PhotoPicker } from "@/components/photos/photo-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { createSpace, deleteSpace, updateSpace, uploadSpacePhoto, type WithId } from "@/lib/data/venues";
import { formatSGD } from "@/lib/money";
import { slideDown } from "@/lib/motion";
import { isTiered, type Space, type Tier } from "@/lib/venues/model";
import { SpaceForm } from "./space-form";

function TierSummary({ label, tier }: { label?: string; tier: Tier }) {
  return (
    <div className="flex flex-col">
      {label && <span className="text-small text-muted">{label}</span>}
      <span className="num">
        {formatSGD(tier.roomRentalCents)} rental
        {tier.minimumSpendCents !== null && <span className="text-muted"> · {formatSGD(tier.minimumSpendCents)} minimum spend</span>}
      </span>
    </div>
  );
}

export function SpacesEditor({ venueId, spaces }: { venueId: string; spaces: WithId<Space>[] }) {
  const [adding, setAdding] = useState(spaces.length === 0);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WithId<Space> | null>(null);
  const toast = useToast();
  const nextOrder = spaces.reduce((m, s) => Math.max(m, s.sortOrder + 1), 0);

  return (
    <div className="flex flex-col gap-5">
      {spaces.length === 0 && !adding && (
        <EmptyState icon={<Users aria-hidden className="size-8" />} title="No spaces yet" action={<Button onClick={() => setAdding(true)}>Add a space</Button>}>
          A space is a room or area you rent out, such as a ballroom or garden.
        </EmptyState>
      )}

      {spaces.map((s) => (
        <Card key={s.id}>
          <CardBody className="flex flex-col gap-5">
            {editing === s.id ? (
              <SpaceForm
                initial={s}
                sortOrder={s.sortOrder}
                submitLabel="Save space"
                onCancel={() => setEditing(null)}
                onSave={async (input) => {
                  await updateSpace(venueId, s.id, input);
                  setEditing(null);
                  toast({ title: "Space saved", tone: "success" });
                }}
              />
            ) : (
              <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
                <div className="flex flex-col gap-3">
                  <h3 className="text-h3">{s.name}</h3>
                  <p className="num">
                    {s.capacityMin} to {s.capacityMax} guests · {s.seatsPerTable} per table
                  </p>
                  {isTiered(s.tiers) ? (
                    <>
                      <TierSummary label="Peak" tier={s.tiers.peak} />
                      <TierSummary label="Off-Peak" tier={s.tiers.offPeak} />
                    </>
                  ) : (
                    <TierSummary tier={s.tiers.standard} />
                  )}
                  {!s.photo && (
                    <Badge tone="warning" className="self-start">
                      Needs a photo before publishing
                    </Badge>
                  )}
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button onClick={() => setEditing(s.id)} icon={<Pencil aria-hidden className="size-4" />}>
                      Edit details
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmDelete(s)} icon={<Trash2 aria-hidden className="size-4" />}>
                      Remove
                    </Button>
                  </div>
                </div>
                <PhotoPicker
                  label="Room photo"
                  photo={s.photo}
                  alt={`${s.name}, empty room`}
                  upload={(image, onProgress) => uploadSpacePhoto(venueId, s, image, onProgress)}
                />
              </div>
            )}
          </CardBody>
        </Card>
      ))}

      <AnimatePresence initial={false}>
        {adding && (
          <motion.div variants={slideDown} initial="hidden" animate="visible" exit="exit">
            <Card>
              <CardBody className="flex flex-col gap-4">
                <h3 className="text-h3">New space</h3>
                <SpaceForm
                  sortOrder={nextOrder}
                  submitLabel="Add space"
                  onCancel={spaces.length ? () => setAdding(false) : undefined}
                  onSave={async (input) => {
                    await createSpace(venueId, input);
                    setAdding(false);
                    toast({ title: "Space added", description: "Now add a photo of the empty room.", tone: "success" });
                  }}
                />
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {!adding && spaces.length > 0 && (
        <Button onClick={() => setAdding(true)} icon={<Plus aria-hidden className="size-4" />} className="self-start">
          Add another space
        </Button>
      )}

      <Modal
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={`Remove ${confirmDelete?.name ?? "this space"}?`}
        description="Its prices and photo will be deleted."
        footer={
          <>
            <Button onClick={() => setConfirmDelete(null)}>Keep it</Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!confirmDelete) return;
                const s = confirmDelete;
                setConfirmDelete(null);
                try {
                  await deleteSpace(venueId, s);
                  toast({ title: "Space removed" });
                } catch {
                  toast({ title: "We couldn't remove that space", tone: "error" });
                }
              }}
            >
              Remove
            </Button>
          </>
        }
      />
    </div>
  );
}
