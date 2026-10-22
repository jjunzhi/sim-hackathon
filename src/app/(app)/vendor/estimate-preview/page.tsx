"use client";

import { useEffect, useMemo, useState } from "react";
import { EstimateView } from "@/components/estimate/estimate-view";
import { RenderPanel } from "@/components/render/render-panel";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { tablesLine } from "@/lib/capacity";
import { watchItems, watchPackages } from "@/lib/data/vendors";
import { watchMyVenues, watchSpaces, type WithId } from "@/lib/data/venues";
import { buildEstimateInput, TIER_LABELS, tierKeys, type Chosen, type TierKey } from "@/lib/estimate/build";
import { calculateEstimate, EstimateError } from "@/lib/estimate/engine";
import type { InventoryItem, InventoryPackage } from "@/lib/inventory/model";
import { UNIT_LABELS } from "@/lib/inventory/model";
import { formatSGD } from "@/lib/money";
import { THEME_OPTIONS } from "@/lib/render/themes";
import type { Space, Venue } from "@/lib/venues/model";
import { useVendor } from "@/lib/vendors/vendor-context";

const DECOR_ONLY = "decor-only";

export default function EstimatePreviewPage() {
  const vendor = useVendor();
  const uid = vendor.status === "ready" ? vendor.uid : null;
  const [venues, setVenues] = useState<WithId<Venue>[]>([]);
  const [spacesByVenue, setSpacesByVenue] = useState<Record<string, WithId<Space>[]>>({});
  const [items, setItems] = useState<WithId<InventoryItem>[]>([]);
  const [packages, setPackages] = useState<WithId<InventoryPackage>[]>([]);
  const [room, setRoom] = useState(DECOR_ONLY);
  const [tierKey, setTierKey] = useState<TierKey | null>(null);
  const [headcount, setHeadcount] = useState(100);
  const [chosen, setChosen] = useState<Chosen>({});
  const [themeId, setThemeId] = useState<string>(THEME_OPTIONS[0].value);

  useEffect(() => {
    if (!uid) return;
    const subs = [watchMyVenues(uid, setVenues, () => undefined), watchItems(uid, setItems, () => undefined), watchPackages(uid, setPackages, () => undefined)];
    return () => subs.forEach((u) => u());
  }, [uid]);

  const venueIds = venues.map((v) => v.id).join(",");
  useEffect(() => {
    if (!venueIds) return;
    const subs = venueIds.split(",").map((id) => watchSpaces(id, (s) => setSpacesByVenue((prev) => ({ ...prev, [id]: s })), () => undefined));
    return () => subs.forEach((u) => u());
  }, [venueIds]);

  const roomOptions = [
    { value: DECOR_ONLY, label: "Decor only (no room)" },
    ...venues.flatMap((v) => (spacesByVenue[v.id] ?? []).map((s) => ({ value: `${v.id}/${s.id}`, label: `${v.name}: ${s.name}` }))),
  ];
  const space = useMemo(() => {
    if (room === DECOR_ONLY) return null;
    const [vid, sid] = room.split("/");
    return spacesByVenue[vid!]?.find((s) => s.id === sid) ?? null;
  }, [room, spacesByVenue]);
  const keys = space ? tierKeys(space) : [];
  const activeTier = space ? (tierKey && keys.includes(tierKey) ? tierKey : keys[0]!) : null;
  const maxGuests = space ? space.capacityMax : 1000;
  const guests = Math.min(headcount, maxGuests);

  const activeItems = items.filter((i) => i.active);
  const activePackages = packages.filter((p) => p.active);
  const includedBy = (itemId: string) => activePackages.find((p) => chosen[`package:${p.id}`] !== undefined && p.itemIds.includes(itemId));

  function toggle(key: string, on: boolean) {
    setChosen((prev) => {
      const next = { ...prev };
      if (on) next[key] = 1;
      else delete next[key];
      // Choosing a package drops the items it already includes.
      if (on && key.startsWith("package:")) {
        const pkg = activePackages.find((p) => `package:${p.id}` === key);
        pkg?.itemIds.forEach((id) => delete next[`item:${id}`]);
      }
      return next;
    });
  }

  // Render: chosen items plus the items inside chosen packages, photo required, at most 10.
  const renderItemIds = [
    ...new Set([
      ...activeItems.filter((i) => chosen[`item:${i.id}`] !== undefined).map((i) => i.id),
      ...activePackages.filter((p) => chosen[`package:${p.id}`] !== undefined).flatMap((p) => p.itemIds),
    ]),
  ];
  const withPhoto = renderItemIds.filter((id) => activeItems.find((i) => i.id === id)?.photo);
  const withoutPhoto = renderItemIds.length - withPhoto.length;
  const [venueId, spaceId] = room === DECOR_ONLY ? [null, null] : room.split("/");
  const renderRequest =
    uid && venueId && spaceId ? { venueId, spaceId, themeId, items: withPhoto.slice(0, 10).map((itemId) => ({ vendorUid: uid, itemId })) } : null;
  const renderBlocked =
    withPhoto.length > 10 ? "Renders can show up to 10 items. Deselect a few to render." : !space?.photo && space ? "This room needs a photo before it can be rendered." : null;

  let result: { estimate: ReturnType<typeof calculateEstimate> } | { error: string } | null = null;
  if (vendor.status === "ready") {
    try {
      const input = buildEstimateInput({ headcount: guests, space, tierKey: activeTier, items: activeItems, packages: activePackages, chosen, tax: vendor.profile.tax });
      result = { estimate: calculateEstimate(input) };
    } catch (err) {
      result = { error: err instanceof EstimateError ? err.message : "Something in this selection can't be priced." };
    }
  }

  return (
    <main className="container-page flex flex-col gap-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1">Estimate preview</h1>
        <p className="max-w-2xl text-muted">Try your real prices the way couples will. Nothing here is saved or sent.</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_26rem]">
        <Card>
          <CardBody className="flex flex-col gap-6">
            <Select label="Room" options={roomOptions} value={room} onValueChange={setRoom} />
            {space && keys.length > 1 && (
              <Select
                label="Pricing"
                options={keys.map((k) => ({ value: k, label: TIER_LABELS[k] }))}
                value={activeTier ?? undefined}
                onValueChange={(v) => setTierKey(v as TierKey)}
              />
            )}
            <Slider
              label="Guests"
              value={guests}
              onValueChange={setHeadcount}
              min={1}
              max={maxGuests}
              valueText={(v) => `${v} guests`}
              displayValue={<AnimatedNumber value={guests} />}
            >
              <p className="num text-ink">{tablesLine(guests, space?.seatsPerTable ?? 10)}</p>
            </Slider>

            <fieldset className="flex flex-col gap-1">
              <legend className="mb-2 text-small font-semibold text-ink">Items</legend>
              {activeItems.length === 0 && <p className="text-small text-muted">No items available yet. Add them under Inventory.</p>}
              {activeItems.map((i) => {
                const key = `item:${i.id}`;
                const pkg = includedBy(i.id);
                const on = chosen[key] !== undefined;
                return (
                  <div key={i.id} className="flex flex-wrap items-end gap-x-4">
                    <Checkbox
                      label={i.name}
                      description={pkg ? `Included in ${pkg.name}` : `${formatSGD(i.priceCents)} ${UNIT_LABELS[i.unit]}`}
                      checked={on}
                      disabled={!!pkg}
                      onCheckedChange={(c) => toggle(key, c)}
                    />
                    {on && i.unit === "piece" && (
                      <Input
                        label={`Quantity of ${i.name}`}
                        inputMode="numeric"
                        className="num mb-2 w-32"
                        value={String(chosen[key])}
                        onChange={(e) => {
                          const n = Number(e.target.value.replace(/\D/g, "") || "0");
                          setChosen((prev) => ({ ...prev, [key]: n }));
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </fieldset>

            {activePackages.length > 0 && (
              <fieldset className="flex flex-col gap-1">
                <legend className="mb-2 text-small font-semibold text-ink">Packages</legend>
                {activePackages.map((p) => (
                  <Checkbox
                    key={p.id}
                    label={p.name}
                    description={`${formatSGD(p.priceCents)} ${UNIT_LABELS[p.unit]}`}
                    checked={chosen[`package:${p.id}`] !== undefined}
                    onCheckedChange={(c) => toggle(`package:${p.id}`, c)}
                  />
                ))}
              </fieldset>
            )}
          </CardBody>
        </Card>

        <Card className="lg:sticky lg:top-6">
          <CardBody>
            {result && "estimate" in result ? (
              <EstimateView estimate={result.estimate} />
            ) : result ? (
              <p role="alert" className="text-error">
                {result.error}
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <div className="flex flex-col gap-4">
            <Select label="Theme" options={[...THEME_OPTIONS]} value={themeId} onValueChange={setThemeId} hint="Cultural themes are pending community review." />
            {withoutPhoto > 0 && (
              <p className="text-small text-muted">
                {withoutPhoto} selected {withoutPhoto === 1 ? "item has" : "items have"} no photo, so {withoutPhoto === 1 ? "it isn't" : "they aren't"} shown in renders. The estimate still includes {withoutPhoto === 1 ? "it" : "them"}.
              </p>
            )}
          </div>
          <RenderPanel request={renderRequest} roomPhoto={space?.photo ?? null} disabledReason={room === DECOR_ONLY ? "Choose a room to render it decorated." : renderBlocked} />
        </CardBody>
      </Card>
    </main>
  );
}
