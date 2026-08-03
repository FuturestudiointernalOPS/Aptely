import { useEffect, useCallback } from "react";
import { useAuth } from "./auth";

const isDev = process.env.NODE_ENV !== "production";

const FORM_TTL_MS = 15 * 60 * 1000;

type StoredFormPayload<T> = {
  savedAt: number;
  data: T;
};

/**
 * Hook to keep the user session alive while they're working on a page.
 * Refreshes the JWT every 5 minutes to prevent session expiration during long form fills.
 * 
 * Usage:
 * ```tsx
 * export default function MyPage() {
 *   useSessionKeepAlive(); // Automatically refreshes token every 5 min
 *   ...
 * }
 * ```
 */
export function useSessionKeepAlive(intervalMs: number = 5 * 60 * 1000) {
  const { user } = useAuth();

  const refreshSession = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch("/api/backend/auth/me", { method: "GET" });
      if (!response.ok && isDev) {
        console.warn("[SESSION] Refresh failed with status:", response.status);
      }
    } catch (err) {
      if (isDev) console.error("[SESSION] Refresh error:", err);
    }
  }, [user]);

  useEffect(() => {
    // Set up interval to refresh session
    const interval = setInterval(refreshSession, intervalMs);

    // Cleanup
    return () => clearInterval(interval);
  }, [refreshSession, intervalMs]);
}

/**
 * Hook to auto-save form data to localStorage
 */
export function useAutoSaveForm<T>(
  storageKey: string,
  formData: T,
  debounceMs: number = 1000,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;
    
    const timer = setTimeout(() => {
      try {
        const payload: StoredFormPayload<T> = {
          savedAt: Date.now(),
          data: formData,
        };
        localStorage.setItem(`form_${storageKey}`, JSON.stringify(payload));
        console.log(`[AUTOSAVE] Form "${storageKey}" saved to localStorage`);
      } catch (err) {
        console.error(`[AUTOSAVE] Failed to save form: ${err}`);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [formData, storageKey, debounceMs, enabled]);
}

/**
 * Hook to restore form data from localStorage
 */
export function useRestoreForm<T>(storageKey: string, defaultValue: T): T | null {
  try {
    const saved = localStorage.getItem(`form_${storageKey}`);
    if (!saved) return null;

    const restored = JSON.parse(saved) as StoredFormPayload<T> | T;
    if (
      restored
      && typeof restored === "object"
      && "savedAt" in restored
      && "data" in restored
    ) {
      if (Date.now() - restored.savedAt > FORM_TTL_MS) {
        localStorage.removeItem(`form_${storageKey}`);
        console.log(`[RESTORE] Form "${storageKey}" expired and was removed`);
        return null;
      }
      console.log(`[RESTORE] Form "${storageKey}" restored from localStorage`);
      return restored.data as T;
    }

    // Backward compatibility for older saves without TTL envelope.
    console.log(`[RESTORE] Form "${storageKey}" restored from legacy localStorage payload`);
    return restored as T;
  } catch (err) {
    console.error(`[RESTORE] Failed to restore form: ${err}`);
  }
  return null;
}

/**
 * Hook to clear saved form data
 */
export function useClearSavedForm(storageKey: string) {
  return () => {
    try {
      localStorage.removeItem(`form_${storageKey}`);
      console.log(`[RESTORE] Form "${storageKey}" cleared from localStorage`);
    } catch (err) {
      console.error(`[RESTORE] Failed to clear form: ${err}`);
    }
  };
}
