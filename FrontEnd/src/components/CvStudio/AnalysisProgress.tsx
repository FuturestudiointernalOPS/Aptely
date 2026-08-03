"use client";

import { CheckCircle, Loader2, XCircle, Clock, SkipForward } from "lucide-react";

interface ModuleStatus {
  key: string;
  label: string;
  status: string;
}

interface AnalysisProgressProps {
  modules: ModuleStatus[];
  completedCount: number;
  totalCount: number;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle size={14} style={{ color: "var(--success)" }} />;
    case "failed":
      return <XCircle size={14} style={{ color: "var(--error)" }} />;
    case "processing":
      return <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent)" }} />;
    case "skipped":
      return <SkipForward size={14} style={{ color: "var(--text-muted)" }} />;
    default:
      return <Clock size={14} style={{ color: "var(--text-muted)" }} />;
  }
}

export default function AnalysisProgress({
  modules,
  completedCount,
  totalCount,
}: AnalysisProgressProps) {
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label={`Analysis progress: ${completedCount} of ${totalCount} modules complete`}>
      <div className="flex items-center gap-3">
        <div
          className="flex-1 h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--bg-raised)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              backgroundColor: "var(--accent)",
            }}
          />
        </div>
        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          {completedCount}/{totalCount}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {modules.map((m) => (
          <div
            key={m.key}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            <StatusIcon status={m.status} />
            <span className="truncate">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
