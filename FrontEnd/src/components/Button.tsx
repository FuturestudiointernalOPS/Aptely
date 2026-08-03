import { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
    size?: "sm" | "md" | "lg";
    isLoading?: boolean;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
}

export default function Button({
    children,
    variant = "primary",
    size = "md",
    isLoading = false,
    iconLeft,
    iconRight,
    className = "",
    disabled,
    ...props
}: ButtonProps) {
    const baseStyles =
        "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-[background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
        primary:
            "bg-[var(--accent)] text-white hover:opacity-90 shadow-e1 hover:shadow-e2",
        secondary:
            "bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] hover:border-[var(--accent)]/40",
        outline:
            "bg-transparent border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)]",
        danger:
            "bg-red-500/10 border border-red-400/25 text-red-400 hover:bg-red-500/20 hover:border-red-500/40",
        ghost:
            "bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-primary)]",
    };

    const sizes = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-5 py-2.5 text-sm",
        lg: "px-7 py-3 text-base",
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
                iconLeft
            )}
            {children}
            {!isLoading && iconRight}
        </button>
    );
}
