"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, className, maxLength, value, ...props },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hintId = `${fieldId}-hint`;
  const errorId = error ? `${fieldId}-error` : undefined;
  const count = typeof value === "string" ? value.length : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={fieldId} className="text-small font-semibold text-ink">
        {label}
      </label>
      <textarea
        ref={ref}
        id={fieldId}
        value={value}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint || maxLength ? hintId : undefined, errorId].filter(Boolean).join(" ") || undefined}
        className={cn(
          "min-h-32 rounded-lg border bg-surface px-4 py-3 text-body text-ink placeholder:text-muted",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          error ? "border-error" : "border-line-strong",
        )}
        {...props}
      />
      {(hint || maxLength) && !error && (
        <p id={hintId} className="flex justify-between gap-4 text-small text-muted">
          <span>{hint}</span>
          {maxLength && count !== undefined && (
            <span className="num">
              {count}/{maxLength}
            </span>
          )}
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
