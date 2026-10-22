import { BadgeCheck, CircleAlert, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "estimate" | "confirmed" | "warning" | "expired" | "sample" | "neutral";

const tones: Record<Tone, { className: string; icon: React.ReactNode }> = {
  estimate: { className: "bg-subtle text-ink border-line", icon: <FileText aria-hidden className="size-3.5" /> },
  confirmed: { className: "bg-surface text-success border-success", icon: <BadgeCheck aria-hidden className="size-3.5" /> },
  warning: { className: "bg-surface text-warning border-warning-icon", icon: <CircleAlert aria-hidden className="size-3.5" /> },
  expired: { className: "bg-surface text-error border-error", icon: <CircleAlert aria-hidden className="size-3.5" /> },
  sample: { className: "bg-surface text-ink border-gold", icon: <Sparkles aria-hidden className="size-3.5 text-gold" /> },
  neutral: { className: "bg-surface text-muted border-line", icon: null },
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Hide the default icon. Meaning is always carried by the text. */
  plain?: boolean;
}

export function Badge({ tone = "neutral", plain, className, children, ...props }: BadgeProps) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-small font-semibold",
        t.className,
        className,
      )}
      {...props}
    >
      {!plain && t.icon}
      {children}
    </span>
  );
}
