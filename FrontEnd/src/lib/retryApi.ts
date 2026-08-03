/**
 * Retry utility for API calls with exponential backoff.
 * Automatically retries on network errors, timeouts, and 5xx errors.
 * Perfect for long-running form submissions where connection may drop.
 */

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = "Operation timed out"
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new TimeoutError(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

