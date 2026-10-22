"use client";

import { ImageOff, Pencil, Trash2 } from "lucide-react";
import { StorageImage } from "@/components/photos/storage-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { UNIT_LABELS, type Unit } from "@/lib/inventory/model";
import { formatSGD } from "@/lib/money";
import type { StoredPhoto } from "@/lib/venues/model";

/** Compact list row shared by items and packages. */
export function InventoryRow({
  name,
  meta,
  priceCents,
  unit,
  photo,
  active,
  onToggleActive,
  onEdit,
  onRemove,
  children,
}: {
  name: string;
  meta?: React.ReactNode;
  priceCents: number;
  unit: Unit;
  photo: StoredPhoto | null;
  active: boolean;
  onToggleActive: (active: boolean) => void;
  onEdit: () => void;
  onRemove: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="w-full shrink-0 sm:w-36">
          {photo ? (
            <StorageImage photo={photo} alt={name} sizes="(min-width: 40rem) 144px, 100vw" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 rounded-xl bg-subtle text-muted" style={{ aspectRatio: "4 / 3" }}>
              <ImageOff aria-hidden className="size-5" />
              <span className="text-small">No photo</span>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-h3">{name}</h3>
            {!active && <Badge tone="neutral">Hidden</Badge>}
            {!photo && <Badge tone="warning">Needs a photo</Badge>}
          </div>
          {meta && <div className="text-small text-muted">{meta}</div>}
          <p className="num font-semibold">
            {formatSGD(priceCents)} <span className="font-normal text-muted">{UNIT_LABELS[unit]}</span>
          </p>
          {children}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Checkbox label="Available to couples" checked={active} onCheckedChange={onToggleActive} />
            <Button onClick={onEdit} icon={<Pencil aria-hidden className="size-4" />}>
              Edit
            </Button>
            <Button variant="ghost" onClick={onRemove} icon={<Trash2 aria-hidden className="size-4" />}>
              Remove
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
