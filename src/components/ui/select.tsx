"use client";

import { Select as RSelect } from "radix-ui";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps {
  label: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  hint?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({
  label,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Choose one",
  hint,
  className,
  disabled,
}: SelectProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label id={`${id}-label`} htmlFor={id} className="text-small font-semibold text-ink">
        {label}
      </label>
      <RSelect.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled}>
        <RSelect.Trigger
          id={id}
          aria-describedby={hintId}
          className={cn(
            "flex min-h-12 w-full items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface px-4 text-left text-body text-ink",
            "transition-colors duration-150 hover:bg-subtle data-[placeholder]:text-muted disabled:opacity-55",
          )}
        >
          <RSelect.Value placeholder={placeholder} />
          <RSelect.Icon>
            <ChevronDown aria-hidden className="size-5 text-muted" />
          </RSelect.Icon>
        </RSelect.Trigger>
        <RSelect.Portal>
          <RSelect.Content
            position="popper"
            sideOffset={6}
            collisionPadding={16}
            className={cn(
              // Popper mode + available-height keeps the list fully on screen at 390px.
              "z-50 max-h-[var(--radix-select-content-available-height)] w-[var(--radix-select-trigger-width)] min-w-48",
              "overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-lift",
            )}
          >
            <RSelect.ScrollUpButton className="flex h-8 items-center justify-center text-muted">
              <ChevronUp aria-hidden className="size-4" />
            </RSelect.ScrollUpButton>
            <RSelect.Viewport className="p-1.5">
              {options.map((o) => (
                <RSelect.Item
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  className={cn(
                    "relative flex min-h-11 cursor-pointer select-none flex-col justify-center rounded-lg py-2 pl-9 pr-3 outline-none",
                    "data-[highlighted]:bg-accent-tint data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
                  )}
                >
                  <RSelect.ItemIndicator className="absolute left-2.5 top-1/2 -translate-y-1/2">
                    <Check aria-hidden className="size-4 text-accent-text" />
                  </RSelect.ItemIndicator>
                  <RSelect.ItemText>{o.label}</RSelect.ItemText>
                  {o.description && <span className="text-small text-muted">{o.description}</span>}
                </RSelect.Item>
              ))}
            </RSelect.Viewport>
            <RSelect.ScrollDownButton className="flex h-8 items-center justify-center text-muted">
              <ChevronDown aria-hidden className="size-4" />
            </RSelect.ScrollDownButton>
          </RSelect.Content>
        </RSelect.Portal>
      </RSelect.Root>
      {hint && (
        <p id={hintId} className="text-small text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
