export function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse rounded-md bg-[var(--bg-raised)] ${className}`} aria-hidden="true" />;
}
