"use client";

import { Checkbox as RCheckbox } from "radix-ui";
import { Check } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ label, description, checked, defaultChecked, onCheckedChange, disabled, className }: CheckboxProps) {
  const id = useId();
  return (
    <div className={cn("flex min-h-11 items-start gap-3 py-1", className)}>
      <RCheckbox.Root
        id={id}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={(c) => onCheckedChange?.(c === true)}
        disabled={disabled}
        aria-describedby={description ? `${id}-desc` : undefined}
        className={cn(
          // 24px box inside a 44px hit area (the label row is also clickable).
          "relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-line-strong bg-surface",
          "transition-colors duration-150 data-[state=checked]:border-accent data-[state=checked]:bg-accent",
          "before:absolute before:-inset-2.5 before:content-[''] disabled:opacity-55",
        )}
      >
        <RCheckbox.Indicator>
          <Check aria-hidden strokeWidth={3} className="size-4 text-on-accent" />
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      <div className="flex flex-col">
        <label htmlFor={id} className="cursor-pointer text-body text-ink">
          {label}
        </label>
        {description && (
          <span id={`${id}-desc`} className="text-small text-muted">
            {description}
          </span>
        )}
      </div>
    </div>
  );
}
