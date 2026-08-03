"use client";

import { useState, useMemo } from "react";
import type { CandidateInterviewHistoryEnrichedItem } from "@/lib/api";
import { getClientLocale, t } from "@/lib/i18n";
import { Clock, Search, ChevronDown, Filter } from "lucide-react";

interface InterviewHistoryProps {
  history: CandidateInterviewHistoryEnrichedItem[];
  onSelectInterview: (interviewId: string) => void;
  selectedInterviewId: string | null;
}

function scorecardBadge(status: string): string {
  switch (status) {
    case "SUBMITTED":
      return "bg-emerald-400/10 text-emerald-400";
    case "DRAFT":
      return "bg-amber-400/10 text-amber-400";
    case "ARCHIVED":
      return "bg-red-400/10 text-red-400";
    default:
      return "bg-[var(--bg-surface)] text-[var(--text-muted)]";
  }
}

function interviewBadge(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-400/10 text-emerald-400";
    case "SCHEDULED":
      return "bg-blue-400/10 text-blue-400";
    case "CANCELLED":
      return "bg-red-400/10 text-red-400";
    default:
      return "bg-[var(--bg-surface)] text-[var(--text-muted)]";
  }
}

const PAGE_SIZE = 15;

export default function InterviewHistory({
  history,
  onSelectInterview,
  selectedInterviewId,
}: InterviewHistoryProps) {
  const locale = getClientLocale();
  const tr = (key: string, fallback: string) => t(locale, key, fallback);
  const localeTag = locale === "fr" ? "fr-FR" : "en-US";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [scorecardFilter, setScorecardFilter] = useState<string>("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    return history.filter((item) => {
      const name = (item.interview.name || "").toLowerCase();
      const searchLower = search.toLowerCase();
      if (searchLower && !name.includes(searchLower)) return false;
      if (statusFilter !== "ALL" && item.interview.status !== statusFilter) return false;
      if (scorecardFilter !== "ALL" && item.myScorecardStatus !== scorecardFilter) return false;
      return true;
    });
  }, [history, search, statusFilter, scorecardFilter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-[var(--accent)]" />
        <h3 className="text-[var(--text-primary)] font-bold text-lg">
          {tr("interview.history.title", "Interview history")}
          <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
            ({filtered.length})
          </span>
        </h3>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`ml-auto p-1.5 rounded-lg transition-colors ${
            showFilters ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
          title={tr("interview.history.filters", "Filters")}
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={13} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
            placeholder={tr("interview.history.searchPlaceholder", "Search by name...")}
            className="w-full pl-8 pr-3 py-2 bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40"
          />
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="ALL">{tr("interview.history.filterAll", "All statuses")}</option>
              <option value="SCHEDULED">{tr("interview.history.filterScheduled", "Scheduled")}</option>
              <option value="COMPLETED">{tr("interview.history.filterCompleted", "Completed")}</option>
              <option value="CANCELLED">{tr("interview.history.filterCancelled", "Cancelled")}</option>
            </select>
            <select
              value={scorecardFilter}
              onChange={(e) => { setScorecardFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-raised)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="ALL">{tr("interview.history.filterAllScorecards", "All scorecards")}</option>
              <option value="NONE">{tr("interview.history.filterNone", "Not filled")}</option>
              <option value="DRAFT">{tr("interview.history.filterDraft", "Draft")}</option>
              <option value="SUBMITTED">{tr("interview.history.filterSubmitted", "Submitted")}</option>
            </select>
          </div>
        )}
      </div>

      {history.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-5 text-center">
          <p className="text-sm font-semibold text-[var(--text-secondary)]">{tr("interview.history.emptyTitle", "No interview found.")}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{tr("interview.history.emptySubtitle", "Schedule an interview to start evaluations.")}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-5 text-center">
          <p className="text-sm font-semibold text-[var(--text-secondary)]">{tr("interview.history.noResults", "No interviews match your filters.")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => {
            const active = selectedInterviewId === item.interview.id;
            return (
              <div
                key={item.interview.id}
                className={`rounded-xl border p-4 transition-all cursor-pointer ${
                  active ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--accent)]/30"
                }`}
                onClick={() => onSelectInterview(item.interview.id)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-bold text-[var(--text-primary)] text-sm">{item.interview.name || tr("interview.common.interview", "Interview")}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${interviewBadge(item.interview.status)}`}>
                        {item.interview.status}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${scorecardBadge(item.myScorecardStatus)}`}>
                        {tr("interview.history.scorecard", "Scorecard")}: {item.myScorecardStatus === "NONE" ? tr("interview.history.scorecardNone", "NOT FILLED") : item.myScorecardStatus}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${active ? "rotate-180" : ""}`} />
                </div>

                {item.interview.scheduledAt && (
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    {tr("interview.history.scheduledOn", "Scheduled on")} {new Date(item.interview.scheduledAt).toLocaleString(localeTag)}
                  </p>
                )}
              </div>
            );
          })}

          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="w-full py-2.5 text-xs font-bold text-[var(--accent)] hover:bg-[var(--accent-dim)] rounded-lg transition-colors"
            >
              {tr("interview.history.showMore", "Show more")} ({filtered.length - visibleCount})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
