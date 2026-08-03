import { ReactNode } from "react";

export function PageHeader({
    title,
    subtitle,
    actions,
    icon,
    className = "",
}: {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    /** Optional leading glyph rendered inside an accent-dim badge. */
    icon?: ReactNode;
    className?: string;
}) {
    return (
        <div className={`flex items-start justify-between gap-4 flex-wrap ${className}`}>
            <div className="flex items-center gap-3 min-w-0">
                {icon && (
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent-dim)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
                        {icon}
                    </div>
                )}
                <div className="min-w-0">
                    <h1 className="text-page-title text-[var(--text-primary)]">{title}</h1>
                    {subtitle && <p className="text-[var(--text-muted)] text-sm mt-1">{subtitle}</p>}
                </div>
            </div>
            {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
    );
}
