import { ReactNode } from "react";

export function EmptyState({
    icon,
    title,
    description,
    action,
    className = "",
}: {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div className={`flex flex-col items-center justify-center text-center py-14 px-6 ${className}`}>
            {icon && (
                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] mb-4">
                    {icon}
                </div>
            )}
            <p className="text-card-title text-[var(--text-primary)]">{title}</p>
            {description && (
                <p className="text-sm text-[var(--text-muted)] mt-1 max-w-sm">{description}</p>
            )}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}
