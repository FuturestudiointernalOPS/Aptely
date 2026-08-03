import { describe, expect, it } from "vitest";
import { TimeoutError, withTimeout } from "./retryApi";

describe("withTimeout", () => {
  it("resolves when promise completes before timeout", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 1000, "too slow");
    expect(result).toBe("ok");
  });

  it("rejects with TimeoutError when promise exceeds timeout", async () => {
    const longPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve("late"), 200);
    });

    await expect(withTimeout(longPromise, 50, "timed out")).rejects.toBeInstanceOf(TimeoutError);
    await expect(withTimeout(longPromise, 50, "timed out")).rejects.toThrow("timed out");
  });
});
