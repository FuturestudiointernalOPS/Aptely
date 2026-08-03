import React from "react";

export default function EndorseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-surface)]">
      <div className="border-b border-[var(--border)] bg-[var(--bg-surface)]/80">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-widest">Aptely</span>
        </div>
      </div>
      {children}
    </div>
  );
}
