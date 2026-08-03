/**
 * APTELY — Retry Helper with Exponential Backoff
 * Used for resilient calls to Supabase and external APIs
 *
 * Strategy:
 * - Retry up to N times with exponential backoff
 * - Initial delay: 100ms → 200ms → 400ms → 800ms
 * - Only retry on network/transient errors (not auth errors)
 * - Log each retry attempt for debugging
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  operation?: string; // For logging
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  operation: "Operation",
};

// Transient errors that are safe to retry
const TRANSIENT_ERROR_PATTERNS = [
  /timeout/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /EHOSTUNREACH/i,
  /ENETUNREACH/i,
  /UND_ERR_CONNECT_TIMEOUT/i,  // Undici Connect Timeout Error
  /503|502|429/,
  /temporarily unavailable/i,
  /connection reset/i,
  /network error/i,
  /fetch failed/i,
];

/**
 * Determine if an error is transient (safe to retry)
 */
function isTransientError(error: any): boolean {
  const errorStr = String(error?.message || error).toLowerCase();
  const errorCode = error?.status || error?.code;

  // Check message patterns
  if (TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(errorStr))) {
    return true;
  }

  // Check HTTP status codes (5xx, 429)
  if (errorCode && (errorCode >= 500 || errorCode === 429)) {
    return true;
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 *
 * Example:
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => supabaseAdmin.auth.admin.createUser(...),
 *   { maxRetries: 3, operation: 'Create Auth User' }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let currentDelay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if error is not transient (e.g., auth error, validation error)
      if (!isTransientError(error)) {
        throw error;
      }

      // Don't retry if we've exhausted retries
      if (attempt === opts.maxRetries) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `[RETRY] ${opts.operation} failed after ${opts.maxRetries} retries: ${errorMsg}`
        );
        throw error;
      }

      // Log retry attempt
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(
        `[RETRY] ${opts.operation} failed (attempt ${attempt + 1}/${opts.maxRetries + 1}), ` +
          `retrying in ${currentDelay}ms: ${errorMsg}`
      );

      // Wait before next attempt
      await delay(currentDelay);

      // Increase delay for next attempt
      currentDelay = Math.min(currentDelay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

