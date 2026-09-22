/**
 * The operator's admin token lives in `sessionStorage`, so it dies with the
 * tab and is never written to disk. It is the platform master credential: it
 * is held in memory for the length of one sitting and nothing longer.
 *
 * Storage access throws in some privacy modes, so every call is guarded and
 * the app treats an unreadable store as "signed out" rather than crashing.
 */
const STORAGE_KEY = "namera-admin-token";

const listeners = new Set<() => void>();
let cached: string | null = null;
let loaded = false;

const notify = () => {
  for (const listener of listeners) listener();
};

export const readToken = (): string | null => {
  if (loaded) return cached;
  try {
    cached = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    cached = null;
  }
  loaded = true;
  return cached;
};

export const writeToken = (token: string): void => {
  cached = token;
  loaded = true;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // A blocked store still leaves the in-memory value usable for this tab.
  }
  notify();
};

export const clearToken = (): void => {
  cached = null;
  loaded = true;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if the store was never writable.
  }
  notify();
};

export const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getSnapshot = (): string | null => readToken();

/** The server rejects anything shorter, so the form can say so before a round trip. */
export const MINIMUM_TOKEN_LENGTH = 32;
