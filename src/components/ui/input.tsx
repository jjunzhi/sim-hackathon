"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label: string;
  hint?: string;
  error?: string;
  /** Text shown inside the field before the value, e.g. "S$". */
  prefix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, prefix, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-small font-semibold text-ink">
        {label}
      </label>
      <div
        className={cn(
          "flex min-h-12 items-center rounded-lg border bg-surface px-4 transition-colors duration-150",
          "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
          error ? "border-error" : "border-line-strong",
        )}
      >
        {prefix && (
          <span aria-hidden className="num mr-2 text-muted">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          className="w-full bg-transparent py-2 text-body text-ink outline-none placeholder:text-muted"
          {...props}
        />
      </div>
      {hint && !error && (
        <p id={hintId} className="text-small text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-small font-medium text-error">
          {error}
        </p>
      )}
    </div>
  );
});
