"use client";

import {
    cloneElement,
    forwardRef,
    isValidElement,
    useId,
    type InputHTMLAttributes,
    type ReactElement,
    type ReactNode,
    type SelectHTMLAttributes,
} from "react";

/* ────────────────────────────────────────────────────────────
   FormField — wraps a single control with a visible label,
   optional helper text, and an error message wired via
   aria-invalid / aria-describedby / role="alert".
   ──────────────────────────────────────────────────────────── */

interface FormFieldProps {
    label: string;
    /** Single form control (Input, Textarea, Select, or any element). */
    children: ReactElement;
    error?: string;
    hint?: string;
    required?: boolean;
    className?: string;
    /** Override the control id (otherwise auto-generated). */
    htmlFor?: string;
}

export function FormField({
    label,
    children,
    error,
    hint,
    required,
    className = "",
    htmlFor,
}: FormFieldProps) {
    const autoId = useId();
    const id = htmlFor ?? (children.props as { id?: string }).id ?? autoId;
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    const describedBy =
        [
            (children.props as { ["aria-describedby"]?: string })["aria-describedby"],
            hint ? hintId : null,
            error ? errorId : null,
        ]
            .filter(Boolean)
            .join(" ") || undefined;

    const control = isValidElement(children)
        ? cloneElement(children, {
              id,
              "aria-invalid": error ? true : undefined,
              "aria-describedby": describedBy,
              "aria-required": required || undefined,
          } as Record<string, unknown>)
        : children;

    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            <label htmlFor={id} className="text-sm font-medium text-[var(--text-secondary)]">
                {label}
                {required && (
                    <span className="ml-0.5 text-[var(--accent)]" aria-hidden="true">
                        *
                    </span>
                )}
            </label>
            {control}
            {hint && !error && (
                <p id={hintId} className="text-xs text-[var(--text-muted)]">
                    {hint}
                </p>
            )}
            {error && (
                <p id={errorId} role="alert" className="text-xs font-medium text-red-400">
                    {error}
                </p>
            )}
        </div>
    );
}

/* ─ Shared control styling (token-driven, ≥44px touch height, 16px text) ─ */
const controlBase =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] px-3.5 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-[border-color,box-shadow] outline-none focus-visible:border-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed aria-[invalid=true]:border-red-400/60 aria-[invalid=true]:focus-visible:border-red-400";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    function Input({ className = "", ...props }, ref) {
        return <input ref={ref} className={`${controlBase} h-11 ${className}`} {...props} />;
    },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
    function Select({ className = "", children, ...props }, ref) {
        return (
            <select ref={ref} className={`${controlBase} h-11 cursor-pointer ${className}`} {...props}>
                {children}
            </select>
        );
    },
);
