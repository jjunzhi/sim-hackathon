"use client";

import { AnimatePresence, motion } from "motion/react";
import { Armchair, Heart, Images, Moon, Sun, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { BeforeAfterSlider } from "@/components/ui/before-after-slider";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { JourneyStepper } from "@/components/ui/journey-stepper";
import { BottomSheet, Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { EmptyState, SkeletonList } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/toast";
import { checkCapacity, tablesLine } from "@/lib/capacity";
import { cn } from "@/lib/cn";
import { formatSGD, multiplyCents } from "@/lib/money";
import { revealContainer, revealItem, revealViewport, slideDown } from "@/lib/motion";
import { couple, vendor } from "@/design/tokens.mjs";

type Theme = "couple" | "vendor";

// SAMPLE values for the showcase only. Not real venue data.
const SAMPLE_ROOM = { name: "SAMPLE Garden Ballroom", min: 80, max: 250 };
const SAMPLE_PER_GUEST_CENTS = 18_800;

const STEPS = [
  { id: "venue", label: "Venue" },
  { id: "style", label: "Style" },
  { id: "render", label: "Render" },
  { id: "estimate", label: "Estimate" },
  { id: "share", label: "Share" },
];

const THEMES_OPTIONS = [
  { value: "peranakan", label: "Peranakan" },
  { value: "botanical", label: "Modern Botanical" },
  { value: "chinese", label: "Chinese" },
  { value: "malay", label: "Malay Pelamin" },
  { value: "indian", label: "Indian Vivaha" },
  { value: "fusion-cm", label: "Fusion: Chinese and Malay", description: "Blends elements from both traditions" },
  { value: "fusion-ci", label: "Fusion: Chinese and Indian", description: "Blends elements from both traditions" },
];

function Section({ id, title, children, intro }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6 border-t border-line py-10 sm:py-14">
      <div className="flex flex-col gap-2">
        <h2 id={id} className="text-h2">
          {title}
        </h2>
        {intro && <p className="max-w-2xl text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  const options: Array<{ value: Theme; label: string; icon: React.ReactNode }> = [
    { value: "couple", label: "Couple light", icon: <Sun aria-hidden className="size-4" /> },
    { value: "vendor", label: "Vendor dark", icon: <Moon aria-hidden className="size-4" /> },
  ];
  return (
    <div role="group" aria-label="Theme" className="inline-flex self-start rounded-full border border-line-strong bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={theme === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-small font-semibold transition-colors duration-150",
            theme === o.value ? "bg-ink text-bg" : "text-muted hover:text-ink",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Swatches({ theme }: { theme: Theme }) {
  const palette = theme === "couple" ? couple : vendor;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Object.entries(palette).map(([name, hex]) => (
        <li key={name} className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="h-14 border-b border-line" style={{ background: hex }} />
          <div className="p-2.5">
            <p className="text-small font-semibold text-ink">{name}</p>
            <p className="num text-small text-muted">{hex}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function HeadcountDemo() {
  const [headcount, setHeadcount] = useState(185);
  const range = { min: 40, max: 300 };
  const cap = checkCapacity(headcount, SAMPLE_ROOM);
  const warn = cap.status !== "within";
  const total = multiplyCents(SAMPLE_PER_GUEST_CENTS, headcount);

  const message =
    cap.status === "over"
      ? `Over this room's maximum of ${SAMPLE_ROOM.max} guests. Trim the list or look at a larger space.`
      : cap.status === "under"
        ? `Below this room's minimum of ${SAMPLE_ROOM.min} guests. Check with the venue before booking.`
        : null;

  return (
    <Card>
      <CardBody className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-small text-muted">Room</p>
            <p className="font-display text-h3">{SAMPLE_ROOM.name}</p>
            <p className="num text-small text-muted">
              Seats {SAMPLE_ROOM.min} to {SAMPLE_ROOM.max} guests
            </p>
          </div>
          <Badge tone="sample">SAMPLE data</Badge>
        </div>

        <Slider
          label="Guests"
          value={headcount}
          onValueChange={setHeadcount}
          min={range.min}
          max={range.max}
          tone={warn ? "warning" : "default"}
          valueText={(v) => `${v} guests`}
          displayValue={<AnimatedNumber value={headcount} />}
        >
          <p className="num text-body text-ink">{tablesLine(headcount)}</p>
          <div className="flex flex-col gap-2">
            {cap.status === "within" && (
              <Badge tone="confirmed" className="self-start">
                Within capacity
              </Badge>
            )}
            {/* Polite live region: announces only when the status changes. */}
            <div aria-live="polite" aria-atomic="true">
              <AnimatePresence initial={false} mode="wait">
                {message && (
                  <motion.p
                    key={cap.status}
                    variants={slideDown}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex items-start gap-2 rounded-lg border border-warning-icon bg-surface p-3 text-small font-medium text-warning"
                  >
                    {message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Slider>

        <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg bg-subtle p-4">
          <div>
            <p className="text-small text-muted">
              SAMPLE package at <span className="num">{formatSGD(SAMPLE_PER_GUEST_CENTS)}</span> per guest
            </p>
            <p className="font-display text-h2">
              <AnimatedNumber value={total} format={(c) => formatSGD(c)} />
            </p>
          </div>
          <Badge tone="estimate">Estimate</Badge>
        </div>
      </CardBody>
    </Card>
  );
}

function AnimatedNumberDemo() {
  const presets = [1_250_000, 3_480_050, 2_199_990];
  const [i, setI] = useState(0);
  const value = presets[i % presets.length] ?? 0;
  return (
    <Card>
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-small text-muted">SAMPLE estimate total</p>
          <p className="font-display text-display leading-none">
            <AnimatedNumber value={value} format={(c) => formatSGD(c)} />
          </p>
        </div>
        <Button onClick={() => setI((n) => n + 1)}>Change the number</Button>
      </CardBody>
    </Card>
  );
}

export function DesignShowcase({ initialTheme = "couple" }: { initialTheme?: Theme }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [step, setStep] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [style, setStyle] = useState<string>("peranakan");
  const toast = useToast();

  // Theme class goes on <html> so portalled overlays and toasts follow it.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("vendor-dark", theme === "vendor");
    return () => root.classList.remove("vendor-dark");
  }, [theme]);

  return (
    <main className="container-page pb-24">
      <header className="flex flex-col gap-6 py-10 sm:py-16">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="sample">SAMPLE content</Badge>
          <span className="text-small text-muted">Internal design reference. Nothing here is real venue data.</span>
        </div>
        <h1 className="text-display">WeddingVista design system</h1>
        <p className="max-w-2xl text-body text-muted">
          Warm, airy and photo-led. Switch themes to check every component in the couple and vendor styles.
        </p>
        <ThemeToggle theme={theme} onChange={setTheme} />
      </header>

      <Section id="colour" title="Colour" intro="Gold is decorative only and never the only sign of meaning.">
        <Swatches theme={theme} />
      </Section>

      <Section id="type" title="Typography">
        <div className="flex flex-col gap-4">
          <p className="text-display">Your day, beautifully planned</p>
          <p className="text-h1">Heading one in Fraunces</p>
          <p className="text-h2">Heading two in Fraunces</p>
          <p className="text-h3">Heading three in Fraunces</p>
          <p className="max-w-2xl">
            Body text is Plus Jakarta Sans at 16px with a relaxed line height, so longer descriptions stay easy to read
            on a phone.
          </p>
          <p className="text-small text-muted">Small supporting text for hints and captions.</p>
          <p className="num text-h3">
            {formatSGD(1_234_500)} · 185 guests · 19 tables
          </p>
        </div>
      </Section>

      <Section id="buttons" title="Buttons and badges" intro="One primary button per screen.">
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">See the estimate</Button>
          <Button>Save for later</Button>
          <Button variant="ghost">Skip for now</Button>
          <Button loading>Saving</Button>
          <Button disabled>Unavailable</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="estimate">Estimate</Badge>
          <Badge tone="confirmed">Vendor Confirmed · Valid until 5 Nov 2026</Badge>
          <Badge tone="expired">Expired</Badge>
          <Badge tone="warning">Over capacity</Badge>
          <Badge tone="sample">SAMPLE</Badge>
          <Badge tone="neutral">Wheelchair access</Badge>
        </div>
      </Section>

      <Section id="forms" title="Form controls">
        <div className="grid gap-6 md:grid-cols-2">
          <Input label="Your name" placeholder="How should vendors address you?" hint="Shown only to vendors you contact." autoComplete="name" />
          <Input label="Room rental" prefix="S$" inputMode="decimal" defaultValue="8,000.00" className="num" />
          <Input label="Email" type="email" defaultValue="not-an-email" error="Enter an email address like name@example.com" />
          <Select label="Theme" options={THEMES_OPTIONS} value={style} onValueChange={setStyle} hint="Fusion themes blend two traditions." />
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-2 text-small font-semibold text-ink">SAMPLE inventory</legend>
          <Checkbox label="Floral arch" description={`${formatSGD(120_000)} per piece`} defaultChecked />
          <Checkbox label="Table centrepieces" description={`${formatSGD(8_800)} per table`} />
          <Checkbox label="Chair sashes" description={`${formatSGD(350)} per guest`} />
          <Checkbox label="Sold out item" description="Not available on your date" disabled />
        </fieldset>
      </Section>

      <Section id="headcount" title="Headcount and capacity" intro="The status is announced to screen readers when it changes.">
        <HeadcountDemo />
      </Section>

      <Section id="number" title="Animated number">
        <AnimatedNumberDemo />
      </Section>

      <Section id="stepper" title="Journey stepper">
        <Card>
          <CardBody className="flex flex-col gap-6">
            <JourneyStepper steps={STEPS} current={step} onStepChange={setStep} />
            <div className="flex gap-3">
              <Button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                Back
              </Button>
              <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1}>
                Next step
              </Button>
            </div>
          </CardBody>
        </Card>
      </Section>

      <Section id="overlays" title="Modals, sheets and toasts" intro="Focus stays inside while open and returns to the button on close.">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button onClick={() => setSheetOpen(true)}>Open bottom sheet</Button>
          <Button onClick={() => toast({ title: "Saved to your project", tone: "success" })}>Success toast</Button>
          <Button onClick={() => toast({ title: "Link copied", description: "Share it with your family." })}>Info toast</Button>
          <Button onClick={() => toast({ title: "We couldn't save that", description: "Please try again in a moment.", tone: "error" })}>
            Error toast
          </Button>
        </div>
        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Remove this render?"
          description="It will no longer appear in your saved renders or family links."
          footer={
            <>
              <Button onClick={() => setModalOpen(false)}>Keep it</Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Remove
              </Button>
            </>
          }
        />
        <BottomSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Filter venues"
          description="SAMPLE filters"
          footer={
            <Button variant="primary" onClick={() => setSheetOpen(false)}>
              Show venues
            </Button>
          }
        >
          <div className="flex flex-col">
            <Checkbox label="Wheelchair access" />
            <Checkbox label="Lift access" />
            <Checkbox label="Garden or outdoor" />
          </div>
        </BottomSheet>
      </Section>

      <Section
        id="compare"
        title="Before and after"
        intro="Drag the handle, or focus it and use the arrow keys (Shift for fine steps)."
      >
        <BeforeAfterSlider
          before={{ src: "/samples/hall-before.svg", alt: "SAMPLE illustration of an empty function hall" }}
          after={{
            src: "/samples/hall-after.svg",
            alt: "SAMPLE illustration of the same hall with a floral arch, draped tables and warm lights",
          }}
          unoptimized
          aspect="4 / 3"
          className="max-w-4xl"
        />
        <p className="text-small text-muted">AI illustration. Final decor may differ.</p>
      </Section>

      <Section id="loading" title="Loading and empty states">
        <div className="grid gap-6 md:grid-cols-2">
          <SkeletonList rows={3} label="Loading saved venues" />
          <EmptyState icon={<Heart className="size-8" aria-hidden />} title="No saved venues yet" action={<Button>Browse venues</Button>}>
            Tap the heart on any venue to keep it here while you decide.
          </EmptyState>
        </div>
      </Section>

      <Section id="reveal" title="Scroll reveal and cards" intro="Cards fade up with a short stagger, once.">
        <motion.ul
          variants={revealContainer}
          initial="hidden"
          whileInView="visible"
          viewport={revealViewport}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {[
            { icon: <Users aria-hidden className="size-5" />, title: "SAMPLE Garden Ballroom", meta: "80 to 250 guests" },
            { icon: <Armchair aria-hidden className="size-5" />, title: "SAMPLE Rooftop Terrace", meta: "40 to 120 guests" },
            { icon: <Images aria-hidden className="size-5" />, title: "SAMPLE Heritage Shophouse", meta: "30 to 80 guests" },
          ].map((c) => (
            <motion.li key={c.title} variants={revealItem}>
              <Card interactive>
                <div className="aspect-[3/2] bg-subtle" />
                <CardBody className="flex flex-col gap-2">
                  <span className="text-gold">{c.icon}</span>
                  <p className="font-display text-h3">{c.title}</p>
                  <p className="num text-small text-muted">{c.meta}</p>
                </CardBody>
              </Card>
            </motion.li>
          ))}
        </motion.ul>
      </Section>
    </main>
  );
}
