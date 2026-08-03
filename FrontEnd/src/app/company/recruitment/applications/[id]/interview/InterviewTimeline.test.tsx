import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import InterviewTimeline from "./InterviewTimeline";
import { getInterviewActivityFeed } from "@/lib/api";

vi.mock("@/lib/api", () => ({
	getInterviewActivityFeed: vi.fn(),
}));

vi.mock("./TimelineEventItem", () => ({
	default: ({ event }: { event: { eventType: string } }) => <div>{event.eventType}</div>,
}));

describe("InterviewTimeline", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders empty state when feed has no events", async () => {
		vi.mocked(getInterviewActivityFeed).mockResolvedValue({
			events: [],
			reminders: null,
			pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
		});

		render(<InterviewTimeline interviewId="int-1" />);

		await waitFor(() => {
			expect(screen.getByText(/No event found for this filter\.|Aucun événement trouvé pour ce filtre\./i)).toBeInTheDocument();
		});
	});

	it("applies event type filter and reloads feed", async () => {
		vi.mocked(getInterviewActivityFeed)
			.mockResolvedValueOnce({
				events: [{ id: "ev-1", eventType: "INTERVIEW_SCHEDULED" } as any],
				reminders: null,
				pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
			})
			.mockResolvedValueOnce({
				events: [{ id: "ev-2", eventType: "REMINDER_SENT" } as any],
				reminders: null,
				pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
			});

		render(<InterviewTimeline interviewId="int-1" />);

		await waitFor(() => {
			expect(getInterviewActivityFeed).toHaveBeenCalledWith("int-1", {
				eventTypes: [],
				page: 1,
				pageSize: 10,
			});
		});

		fireEvent.change(screen.getByRole("combobox"), {
			target: { value: "REMINDER_SENT" },
		});

		await waitFor(() => {
			expect(getInterviewActivityFeed).toHaveBeenLastCalledWith("int-1", {
				eventTypes: ["REMINDER_SENT"],
				page: 1,
				pageSize: 10,
			});
		});
	});
});
