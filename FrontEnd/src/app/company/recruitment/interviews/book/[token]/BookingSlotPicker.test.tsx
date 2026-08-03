import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BookingSlotPicker from "./BookingSlotPicker";

const confirmBookingMock = vi.fn();

vi.mock("@/lib/api", () => ({
  confirmBooking: (...args: unknown[]) => confirmBookingMock(...args),
}));

describe("BookingSlotPicker", () => {
  beforeEach(() => {
    confirmBookingMock.mockReset();
  });

  it("shows empty state then renders slots", async () => {
    const { rerender } = render(
      <BookingSlotPicker token="t1" slots={[]} roleTitle="Backend Engineer" status="PENDING" />
    );

    expect(screen.getByText(/No slot available at the moment\.|Aucun creneau disponible/i)).toBeInTheDocument();

    rerender(
      <BookingSlotPicker
        token="t1"
        roleTitle="Backend Engineer"
        status="PENDING"
        slots={[
          { start: "2026-04-09T09:00:00.000Z", end: "2026-04-09T09:30:00.000Z" },
          { start: "2026-04-09T09:30:00.000Z", end: "2026-04-09T10:00:00.000Z" },
        ]}
      />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(2);
  });

  it("selects a slot and enables confirm", async () => {
    const user = userEvent.setup();

    render(
      <BookingSlotPicker
        token="t1"
        slots={[{ start: "2026-04-09T09:00:00.000Z", end: "2026-04-09T09:30:00.000Z" }]}
      />
    );

    const confirmButton = screen.getByRole("button", { name: /confirm slot/i });
    expect(confirmButton).toBeDisabled();

    const slotButtons = screen
      .getAllByRole("button")
      .filter((button) => button !== confirmButton);

    await user.click(slotButtons[0]);
    expect(confirmButton).toBeEnabled();
  });

  it("shows success after confirm", async () => {
    const user = userEvent.setup();
    confirmBookingMock.mockResolvedValue({ success: true, meetingLink: "https://meet.example/abc" });

    render(
      <BookingSlotPicker
        token="t1"
        slots={[{ start: "2026-04-09T09:00:00.000Z", end: "2026-04-09T09:30:00.000Z" }]}
      />
    );

    const confirmButton = screen.getByRole("button", { name: /confirm slot/i });
    const slotButton = screen
      .getAllByRole("button")
      .find((button) => button !== confirmButton);

    if (!slotButton) {
      throw new Error("Expected at least one slot button");
    }

    await user.click(slotButton);
    await user.click(confirmButton);

    expect(await screen.findByText(/Interview confirmed|Interview confirmee/i)).toBeInTheDocument();
  });

  it("shows error when API fails", async () => {
    const user = userEvent.setup();
    confirmBookingMock.mockRejectedValue(new Error("Network error"));

    render(
      <BookingSlotPicker
        token="t1"
        slots={[{ start: "2026-04-09T09:00:00.000Z", end: "2026-04-09T09:30:00.000Z" }]}
      />
    );

    const confirmButton = screen.getByRole("button", { name: /confirm slot/i });
    const slotButton = screen
      .getAllByRole("button")
      .find((button) => button !== confirmButton);

    if (!slotButton) {
      throw new Error("Expected at least one slot button");
    }

    await user.click(slotButton);
    await user.click(confirmButton);

    expect(await screen.findByText(/An error occurred during confirmation\.|Une erreur est survenue/i)).toBeInTheDocument();
  });

  it("prevents double submit while confirming", async () => {
    const user = userEvent.setup();

    let resolveRequest: ((value: { success: boolean }) => void) | undefined;
    const pendingRequest = new Promise<{ success: boolean }>((resolve) => {
      resolveRequest = resolve;
    });

    confirmBookingMock.mockReturnValue(pendingRequest);

    render(
      <BookingSlotPicker
        token="t1"
        slots={[{ start: "2026-04-09T09:00:00.000Z", end: "2026-04-09T09:30:00.000Z" }]}
      />
    );

    const confirmButton = screen.getByRole("button", { name: /confirm slot/i });
    const slotButton = screen
      .getAllByRole("button")
      .find((button) => button !== confirmButton);

    if (!slotButton || !resolveRequest) {
      throw new Error("Failed to initialize test state");
    }

    await user.click(slotButton);
    await user.click(confirmButton);
    await user.click(confirmButton);

    expect(confirmBookingMock).toHaveBeenCalledTimes(1);

    resolveRequest({ success: true });
    await screen.findByText(/Interview confirmed|Interview confirmee/i);
  });
});
