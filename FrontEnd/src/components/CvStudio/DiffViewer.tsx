"use client";

interface DiffPart {
  added?: boolean;
  removed?: boolean;
  value: string;
}

interface DiffViewerProps {
  changes: DiffPart[];
}

export default function DiffViewer({ changes }: DiffViewerProps) {
  return (
    <div
      className="rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono"
      style={{ backgroundColor: "var(--bg-deep)", color: "var(--text-primary)" }}
    >
      {changes.map((part, i) => {
        if (part.removed) {
          return (
            <span
              key={`${i}-${part.value.slice(0, 8)}`}
              className="line-through"
              style={{ backgroundColor: "rgba(var(--error-rgb, 239,68,68), 0.15)", color: "var(--error)" }}
            >
              {part.value}
            </span>
          );
        }
        if (part.added) {
          return (
            <span
              key={`${i}-${part.value.slice(0, 8)}`}
              style={{ backgroundColor: "rgba(var(--success-rgb, 34,197,94), 0.15)", color: "var(--success)" }}
            >
              {part.value}
            </span>
          );
        }
        return <span key={`${i}-${part.value.slice(0, 8)}`}>{part.value}</span>;
      })}
    </div>
  );
}
