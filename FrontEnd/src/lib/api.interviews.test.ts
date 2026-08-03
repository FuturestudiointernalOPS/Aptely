import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assignInterviewers,
  confirmBooking,
  createInterview,
  getInterviewScoresSummary,
  getBookingByToken,
  getInterviewAvailability,
  scheduleInterview,
  submitInterviewerScore,
} from "./api";

const apiFetchMock = vi.fn();

vi.mock("./apiHelper", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("api interviews helpers", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("maps createInterview payload/response", async () => {
    apiFetchMock.mockResolvedValue({
      id: "int_1",
      applicationId: "app_1",
      status: "DRAFT",
      bookingToken: "tok_1",
      participants: [{ user_id: "u1", evaluation_weight: 100 }],
    });

    const result = await createInterview({ 
      applicationId: "app_1",
      name: "Test Interview",
      interviewType: "CUSTOM"
    });

    expect(apiFetchMock).toHaveBeenCalledWith("/interviews", "HR", expect.objectContaining({ method: "POST" }));
    expect(result).toEqual(
      expect.objectContaining({
        id: "int_1",
        bookingToken: "tok_1",
        participants: [{ userId: "u1", evaluationWeight: 100 }],
      })
    );
  });

  it("calls assignInterviewers endpoint", async () => {
    apiFetchMock.mockResolvedValue({ id: "int_2", participants: [] });

    await assignInterviewers("int_2", [{ userId: "u1", evaluationWeight: 100 }], null);

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/interviews/int_2/interviewers",
      "HR",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("returns slots from availability endpoint", async () => {
    apiFetchMock.mockResolvedValue({
      slots: [{ start: "2026-04-09T09:00:00.000Z", end: "2026-04-09T09:30:00.000Z" }],
    });

    const availability = await getInterviewAvailability("int_3", {
      from: "2026-04-09T00:00:00.000Z",
      to: "2026-04-10T00:00:00.000Z",
      slotMinutes: 30,
      timezone: "UTC",
    });

    expect(availability.slots).toHaveLength(1);
    expect(availability.slots[0].start).toBe("2026-04-09T09:00:00.000Z");
  });

  it("returns success false when booking confirmation fails", async () => {
    apiFetchMock.mockResolvedValue(null);

    const result = await confirmBooking("tok", {
      start: "2026-04-09T09:00:00.000Z",
      timezone: "UTC",
    });

    expect(result).toEqual(expect.objectContaining({ success: false }));
  });

  it("maps booking lookup and schedule response", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        id: "int_5",
        roleTitle: "Backend Engineer",
        status: "READY",
        slots: [{ start: "2026-04-09T09:00:00.000Z", end: "2026-04-09T09:30:00.000Z" }],
      })
      .mockResolvedValueOnce({
        id: "int_5",
        status: "SCHEDULED",
        meetingLink: "https://meet.example/1",
      });

    const booking = await getBookingByToken("tok");
    const scheduled = await scheduleInterview("int_5", {
      start: "2026-04-09T09:00:00.000Z",
      timezone: "UTC",
    });

    expect(booking).toEqual(
      expect.objectContaining({
        interviewId: "int_5",
        roleTitle: "Backend Engineer",
      })
    );

    expect(scheduled).toEqual(
      expect.objectContaining({
        id: "int_5",
        status: "SCHEDULED",
        meetingLink: "https://meet.example/1",
      })
    );
  });

  it("maps weighted interviewer score submit and summary endpoints", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        id: "is_1",
        interviewId: "int_7",
        interviewerId: "u_1",
        globalScoreOver10: 8.8,
        weightedContribution: 5.28,
        comment: "Great profile",
        submittedAt: "2026-04-12T10:00:00.000Z",
      })
      .mockResolvedValueOnce({
        interviewId: "int_7",
        totalSubmitted: 1,
        weightedScoreOver10: 8.8,
        computedAt: "2026-04-12T10:05:00.000Z",
        details: {
          formula: "sum(score_over_10 * evaluation_weight) / 100",
          totalParticipants: 2,
        },
        contributions: [
          {
            interviewerId: "u_1",
            weight: 60,
            scoreOver10: 8.8,
            weightedContribution: 5.28,
            submitted: true,
          },
        ],
      });

    const submitted = await submitInterviewerScore("int_7", "u_1", {
      criteriaScores: [{ criterion: "Communication", scoreOver10: 8.8 }],
      globalScoreOver10: 8.8,
    });
    const summary = await getInterviewScoresSummary("int_7");

    expect(submitted).toEqual(
      expect.objectContaining({
        id: "is_1",
        interviewId: "int_7",
        interviewerId: "u_1",
      })
    );

    expect(summary).toEqual(
      expect.objectContaining({
        interviewId: "int_7",
        totalSubmitted: 1,
        weightedScoreOver10: 8.8,
      })
    );
  });
});
