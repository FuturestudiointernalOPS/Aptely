"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader } from "lucide-react";
import {
	getInterviewActivityFeed,
	type InterviewActivityEvent,
	type InterviewReminderStatus,
} from "@/lib/api";
import { getClientLocale, t } from "@/lib/i18n";
import TimelineEventItem from "./TimelineEventItem";

interface InterviewTimelineProps {
	interviewId: string;
	refreshKey?: number;
	onReminderStatusChange?: (status: InterviewReminderStatus | null) => void;
}

export default function InterviewTimeline({
	interviewId,
	refreshKey = 0,
	onReminderStatusChange,
}: InterviewTimelineProps) {
	const locale = getClientLocale();
	const tr = (key: string, fallback: string) => t(locale, key, fallback);
	const [loading, setLoading] = useState(true);
	const [events, setEvents] = useState<InterviewActivityEvent[]>([]);
	const [eventTypeFilter, setEventTypeFilter] = useState<string>("ALL");
	const [page, setPage] = useState(1);
	const [pageSize] = useState(10);
	const [totalPages, setTotalPages] = useState(1);

	const loadFeed = async () => {
		setLoading(true);
		const feed = await getInterviewActivityFeed(interviewId, {
			eventTypes: eventTypeFilter === "ALL" ? [] : [eventTypeFilter],
			page,
			pageSize,
		});

		if (feed) {
			setEvents(feed.events);
			setTotalPages(feed.pagination.totalPages || 1);
			onReminderStatusChange?.(feed.reminders);
		}
		setLoading(false);
	};

	useEffect(() => {
		setPage(1);
	}, [eventTypeFilter]);

	useEffect(() => {
		loadFeed();
	}, [interviewId, page, pageSize, eventTypeFilter, refreshKey]);

	const filterOptions = useMemo(() => {
		const base = [
			"INTERVIEW_DRAFT_CREATED",
			"INTERVIEWERS_ASSIGNED",
			"INTERVIEW_SCHEDULED",
			"QUESTION_PACK_GENERATED",
			"DEBRIEF_SUBMITTED",
			"INTERVIEW_SCORE_SUBMITTED",
			"REMINDER_24H_SCHEDULED",
			"REMINDER_SENT",
			"REMINDER_FAILED",
		];

		return ["ALL", ...base];
	}, []);

	return (
		<div className="bg-[var(--bg-surface)] border border-[var(--border)] p-5 space-y-4">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				<div>
					<h3 className="text-base font-bold text-[var(--text-primary)]">{tr("interview.timeline.title", "Interview timeline")}</h3>
					<p className="text-xs text-[var(--text-muted)]">{tr("interview.timeline.subtitle", "Complete history of interview events")}</p>
				</div>

				<select
					value={eventTypeFilter}
					onChange={(event) => setEventTypeFilter(event.target.value)}
					className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-xs text-[var(--text-primary)]"
				>
					{filterOptions.map((option) => (
						<option key={option} value={option}>
							{option === "ALL" ? tr("interview.timeline.allEvents", "All events") : option}
						</option>
					))}
				</select>
			</div>

			{loading ? (
				<div className="py-12 flex items-center justify-center">
					<Loader className="w-6 h-6 animate-spin text-[var(--accent)]" />
				</div>
			) : events.length === 0 ? (
				<div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
					{tr("interview.timeline.empty", "No event found for this filter.")}
				</div>
			) : (
				<div className="space-y-2">
					{events.map((event) => (
						<TimelineEventItem key={event.id} event={event} />
					))}
				</div>
			)}

			<div className="flex items-center justify-between pt-2">
				<button
					type="button"
					onClick={() => setPage((p) => Math.max(1, p - 1))}
					disabled={page <= 1}
					className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-50"
				>
					{tr("interview.timeline.previous", "Previous")}
				</button>

				<p className="text-xs text-[var(--text-muted)]">
					{tr("interview.timeline.page", "Page")} {page} / {Math.max(1, totalPages)}
				</p>

				<button
					type="button"
					onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
					disabled={page >= totalPages}
					className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-50"
				>
					{tr("interview.timeline.next", "Next")}
				</button>
			</div>
		</div>
	);
}
