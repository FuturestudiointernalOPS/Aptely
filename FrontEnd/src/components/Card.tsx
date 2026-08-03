import { ReactNode } from "react";

interface CardProps {
    children: ReactNode;
    title?: string;
    subtitle?: string;
    className?: string;
    noPadding?: boolean;
    hoverable?: boolean;
}

export default function Card({
    children,
    title,
    subtitle,
    className = "",
    noPadding = false,
    hoverable = true,
}: CardProps) {
    return (
        <div
            className={`bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl ${hoverable ? "card-interactive" : ""} ${className}`}
        >
            {(title || subtitle) && (
                <div className="px-6 py-4 border-b border-[var(--border)]">
                    {title && <h3 className="font-display font-bold text-lg text-[var(--text-primary)]">{title}</h3>}
                    {subtitle && <p className="text-[var(--text-secondary)] text-sm mt-0.5">{subtitle}</p>}
                </div>
            )}
            <div className={noPadding ? "" : "p-6"}>{children}</div>
        </div>
    );
}
