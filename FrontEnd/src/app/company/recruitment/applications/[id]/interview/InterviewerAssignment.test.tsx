import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InterviewerAssignment from "./InterviewerAssignment";

const getHRMembersPaginatedMock = vi.fn();
const createInterviewMock = vi.fn();
const assignInterviewersMock = vi.fn();
const getInterviewAvailabilityMock = vi.fn();
const scheduleInterviewMock = vi.fn();
const apiFetchMock = vi.fn();

vi.mock("@/lib/api", () => ({
  getHRMembersPaginated: (...args: unknown[]) => getHRMembersPaginatedMock(...args),
  createInterview: (...args: unknown[]) => createInterviewMock(...args),
  assignInterviewers: (...args: unknown[]) => assignInterviewersMock(...args),
  getInterviewAvailability: (...args: unknown[]) => getInterviewAvailabilityMock(...args),
  scheduleInterview: (...args: unknown[]) => scheduleInterviewMock(...args),
}));

vi.mock("@/lib/apiHelper", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("InterviewerAssignment", () => {
  beforeEach(() => {
    getHRMembersPaginatedMock.mockReset();
    createInterviewMock.mockReset();
    assignInterviewersMock.mockReset();
    getInterviewAvailabilityMock.mockReset();
    scheduleInterviewMock.mockReset();
    apiFetchMock.mockReset();

    getHRMembersPaginatedMock.mockResolvedValue({
      members: [
        { userId: "u1", email: "hr1@aptely.com" },
        { userId: "u2", email: "hr2@aptely.com" },
      ],
      meta: { total: 2, page: 1, limit: 20, hasMore: false },
    });
    createInterviewMock.mockResolvedValue({ id: "int_1", bookingToken: "tok_1" });
    assignInterviewersMock.mockResolvedValue({ id: "int_1" });
    getInterviewAvailabilityMock.mockResolvedValue({ slots: [] });
    scheduleInterviewMock.mockResolvedValue(null);
    apiFetchMock.mockResolvedValue({ connected: false, expiresAt: null });
  });

  it("loads and displays interviewer members", async () => {
    render(<InterviewerAssignment applicationId="app_123" />);

    expect(await screen.findByText("hr1@aptely.com")).toBeInTheDocument();
    expect(screen.getByText("hr2@aptely.com")).toBeInTheDocument();
  });

  it("saves interviewer assignment with selected members", async () => {
    const user = userEvent.setup();
    render(<InterviewerAssignment applicationId="app_123" />);

    await screen.findByText("hr1@aptely.com");

    await user.click(screen.getByRole("button", { name: /create.*load|charger le planning/i }));
    await user.click(screen.getByRole("button", { name: "hr1@aptely.com" }));
    await user.click(screen.getByRole("button", { name: /save interviewers|enregistrer/i }));

    expect(assignInterviewersMock).toHaveBeenCalledWith(
      "int_1",
      [{ userId: "u1", evaluationWeight: 100, role: "MANDATORY" }],
      null,
    );
  }, 10000);

  it("disables save while assignment mutation is pending", async () => {
    const user = userEvent.setup();

    let resolveAssign: ((value: { id: string }) => void) | undefined;
    const pendingAssign = new Promise<{ id: string }>((resolve) => {
      resolveAssign = resolve;
    });
    assignInterviewersMock.mockReturnValue(pendingAssign);

    render(<InterviewerAssignment applicationId="app_123" />);
    await screen.findByText("hr1@aptely.com");

    await user.click(screen.getByRole("button", { name: /create.*load|charger le planning/i }));
    await user.click(screen.getByRole("button", { name: "hr1@aptely.com" }));

    const saveButton = screen.getByRole("button", { name: /save interviewers|enregistrer/i });
    await user.click(saveButton);

    expect(saveButton).toBeDisabled();

    if (!resolveAssign) {
      throw new Error("Pending assign promise was not created");
    }
    resolveAssign({ id: "int_1" });
    expect(await screen.findByText(/Interviewers assign/i)).toBeInTheDocument();
  });

  it("shows assignment error feedback", async () => {
    const user = userEvent.setup();

    assignInterviewersMock.mockResolvedValue(null);

    render(<InterviewerAssignment applicationId="app_123" />);
    await screen.findByText("hr1@aptely.com");

    await user.click(screen.getByRole("button", { name: /create.*load|charger le planning/i }));
    await user.click(screen.getByRole("button", { name: "hr1@aptely.com" }));
    await user.click(screen.getByRole("button", { name: /save interviewers|enregistrer/i }));

    expect(await screen.findByText(/Failed to assign|Impossible.*assigner/i)).toBeInTheDocument();
  });
});
