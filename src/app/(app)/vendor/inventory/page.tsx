"use client";

import { AnimatePresence, motion } from "motion/react";
import { Plus, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PhotoPicker } from "@/components/photos/photo-picker";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { EmptyState, SkeletonList } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { CategoryFilter } from "@/components/vendor/category-filter";
import { InventoryRow } from "@/components/vendor/inventory-row";
import { ItemForm } from "@/components/vendor/item-form";
import { createItem, deleteSubDoc, updateSubDoc, uploadSubPhoto, watchItems, watchPackages } from "@/lib/data/vendors";
import type { WithId } from "@/lib/data/venues";
import { CATEGORIES, type InventoryItem, type InventoryPackage } from "@/lib/inventory/model";
import { slideDown } from "@/lib/motion";
import { useVendor } from "@/lib/vendors/vendor-context";

export default function InventoryPage() {
  const vendor = useVendor();
  const uid = vendor.status === "ready" ? vendor.uid : null;
  const toast = useToast();
  const [items, setItems] = useState<WithId<InventoryItem>[] | null>(null);
  const [packages, setPackages] = useState<WithId<InventoryPackage>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<WithId<InventoryItem> | null>(null);

  useEffect(() => {
    if (!uid) return;
    const a = watchItems(uid, setItems, () => setError("We couldn't load your inventory. Please refresh the page."));
    const b = watchPackages(uid, setPackages, () => undefined);
    return () => {
      a();
      b();
    };
  }, [uid]);

  const present = useMemo(() => CATEGORIES.filter((c) => items?.some((i) => i.category === c)), [items]);
  const shown = items?.filter((i) => filter === "All" || i.category === filter) ?? [];

  if (!uid) return null;

  // A package that includes the item would be left pointing at nothing.
  const usedIn = (itemId: string) => packages.filter((p) => p.itemIds.includes(itemId)).map((p) => p.name);

  return (
    <main className="container-page flex flex-col gap-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1">Inventory</h1>
          <p className="max-w-2xl text-muted">Only items you can really deliver. Renders and estimates use exactly these.</p>
        </div>
        {!adding && (
          <Button variant="primary" onClick={() => setAdding(true)} icon={<Plus aria-hidden className="size-5" />}>
            Add an item
          </Button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {adding && (
          <motion.div variants={slideDown} initial="hidden" animate="visible" exit="exit">
            <Card>
              <CardBody className="flex flex-col gap-4">
                <h2 className="text-h3">New item</h2>
                <ItemForm
                  submitLabel="Add item"
                  onCancel={() => setAdding(false)}
                  onSave={async (input) => {
                    const id = await createItem(uid, input);
                    setAdding(false);
                    setEditing(id);
                    toast({ title: "Item added", description: "Now add a photo.", tone: "success" });
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
      {!items && !error && <SkeletonList rows={3} label="Loading inventory" />}
      {items?.length === 0 && !adding && (
        <EmptyState icon={<Sparkles aria-hidden className="size-8" />} title="No items yet" action={<Button onClick={() => setAdding(true)}>Add your first item</Button>}>
          Add florals, lighting, backdrops, table decor and anything else you supply, with real prices.
        </EmptyState>
      )}

      {items && items.length > 0 && (
        <>
          {present.length > 1 && <CategoryFilter options={present} value={filter} onChange={setFilter} />}
          <p className="num text-small text-muted" aria-live="polite">
            Showing {shown.length} of {items.length}
          </p>
          <ul className="flex flex-col gap-4">
            {shown.map((item) => (
              <li key={item.id}>
                {editing === item.id ? (
                  <Card>
                    <CardBody className="grid gap-6 lg:grid-cols-[1fr_20rem]">
                      <ItemForm
                        initial={item}
                        submitLabel="Save item"
                        onCancel={() => setEditing(null)}
                        onSave={async (input) => {
                          await updateSubDoc(uid, "items", item.id, input);
                          setEditing(null);
                          toast({ title: "Item saved", tone: "success" });
                        }}
                      />
                      <PhotoPicker
                        label="Photo"
                        photo={item.photo}
                        alt={item.name}
                        upload={(image, onProgress) => uploadSubPhoto(uid, "items", item, image, onProgress)}
                      />
                    </CardBody>
                  </Card>
                ) : (
                  <InventoryRow
                    name={item.name}
                    meta={item.category}
                    priceCents={item.priceCents}
                    unit={item.unit}
                    photo={item.photo}
                    active={item.active}
                    onToggleActive={(active) =>
                      updateSubDoc(uid, "items", item.id, { active }).catch(() => toast({ title: "We couldn't change that", tone: "error" }))
                    }
                    onEdit={() => setEditing(item.id)}
                    onRemove={() => setRemoving(item)}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.name ?? "this item"}?`}
        description={
          removing && usedIn(removing.id).length
            ? `It's part of ${usedIn(removing.id).join(", ")}. Edit those packages first.`
            : "Its photo will be deleted too."
        }
        footer={
          <>
            <Button onClick={() => setRemoving(null)}>Keep it</Button>
            <Button
              variant="primary"
              disabled={!!removing && usedIn(removing.id).length > 0}
              onClick={async () => {
                if (!removing) return;
                const r = removing;
                setRemoving(null);
                try {
                  await deleteSubDoc(uid, "items", r);
                  toast({ title: "Item removed" });
                } catch {
                  toast({ title: "We couldn't remove that item", tone: "error" });
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
