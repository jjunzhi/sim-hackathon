"use client";

import { AnimatePresence, motion } from "motion/react";
import { Package, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { PhotoPicker } from "@/components/photos/photo-picker";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { EmptyState, SkeletonList } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { InventoryRow } from "@/components/vendor/inventory-row";
import { PackageForm } from "@/components/vendor/package-form";
import { createPackage, deleteSubDoc, updateSubDoc, uploadSubPhoto, watchItems, watchPackages } from "@/lib/data/vendors";
import type { WithId } from "@/lib/data/venues";
import type { InventoryItem, InventoryPackage } from "@/lib/inventory/model";
import { slideDown } from "@/lib/motion";
import { useVendor } from "@/lib/vendors/vendor-context";

export default function PackagesPage() {
  const vendor = useVendor();
  const uid = vendor.status === "ready" ? vendor.uid : null;
  const toast = useToast();
  const [items, setItems] = useState<WithId<InventoryItem>[]>([]);
  const [packages, setPackages] = useState<WithId<InventoryPackage>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<WithId<InventoryPackage> | null>(null);

  useEffect(() => {
    if (!uid) return;
    const onErr = () => setError("We couldn't load your packages. Please refresh the page.");
    const a = watchItems(uid, setItems, onErr);
    const b = watchPackages(uid, setPackages, onErr);
    return () => {
      a();
      b();
    };
  }, [uid]);

  if (!uid) return null;
  const nameOf = (id: string) => items.find((i) => i.id === id)?.name;

  return (
    <main className="container-page flex flex-col gap-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1">Packages</h1>
          <p className="max-w-2xl text-muted">Bundle items you often sell together, at one price.</p>
        </div>
        {!adding && items.length > 0 && (
          <Button variant="primary" onClick={() => setAdding(true)} icon={<Plus aria-hidden className="size-5" />}>
            Add a package
          </Button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {adding && (
          <motion.div variants={slideDown} initial="hidden" animate="visible" exit="exit">
            <Card>
              <CardBody className="flex flex-col gap-4">
                <h2 className="text-h3">New package</h2>
                <PackageForm
                  items={items}
                  submitLabel="Add package"
                  onCancel={() => setAdding(false)}
                  onSave={async (input) => {
                    await createPackage(uid, input);
                    setAdding(false);
                    toast({ title: "Package added", tone: "success" });
                  }}
                />
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      {!packages && !error && <SkeletonList rows={2} label="Loading packages" />}
      {packages?.length === 0 && !adding && (
        <EmptyState icon={<Package aria-hidden className="size-8" />} title="No packages yet">
          {items.length === 0 ? "Add some items to your inventory first, then bundle them here." : "Group items into a package with a single price."}
        </EmptyState>
      )}

      <ul className="flex flex-col gap-4">
        {packages?.map((p) => (
          <li key={p.id}>
            {editing === p.id ? (
              <Card>
                <CardBody className="grid gap-6 lg:grid-cols-[1fr_20rem]">
                  <PackageForm
                    items={items}
                    initial={p}
                    submitLabel="Save package"
                    onCancel={() => setEditing(null)}
                    onSave={async (input) => {
                      await updateSubDoc(uid, "packages", p.id, input);
                      setEditing(null);
                      toast({ title: "Package saved", tone: "success" });
                    }}
                  />
                  <PhotoPicker label="Photo" photo={p.photo} alt={p.name} upload={(image, onProgress) => uploadSubPhoto(uid, "packages", p, image, onProgress)} />
                </CardBody>
              </Card>
            ) : (
              <InventoryRow
                name={p.name}
                meta={`Includes ${p.itemIds.map((id) => nameOf(id) ?? "a removed item").join(", ")}`}
                priceCents={p.priceCents}
                unit={p.unit}
                photo={p.photo}
                active={p.active}
                onToggleActive={(active) =>
                  updateSubDoc(uid, "packages", p.id, { active }).catch(() => toast({ title: "We couldn't change that", tone: "error" }))
                }
                onEdit={() => setEditing(p.id)}
                onRemove={() => setRemoving(p)}
              />
            )}
          </li>
        ))}
      </ul>

      <Modal
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.name ?? "this package"}?`}
        description="The items it includes stay in your inventory."
        footer={
          <>
            <Button onClick={() => setRemoving(null)}>Keep it</Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!removing) return;
                const r = removing;
                setRemoving(null);
                try {
                  await deleteSubDoc(uid, "packages", r);
                  toast({ title: "Package removed" });
                } catch {
                  toast({ title: "We couldn't remove that package", tone: "error" });
                }
              }}
            >
              Remove
            </Button>
          </>
        }
      />
    </main>
  );
}
