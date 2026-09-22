import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearToken, readToken, subscribe, writeToken } from "../src/lib/session.js";

const token = "test-only-admin-token-with-at-least-32-characters";

/** The repo has no DOM test environment, so the storage the module reads is stubbed. */
const installStorage = (overrides: Partial<Storage> = {}) => {
  const values = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    ...overrides,
  };
  vi.stubGlobal("window", { sessionStorage });
  return { values, sessionStorage };
};

describe("admin token storage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    installStorage();
    clearToken();
  });

  it("round-trips a token through session storage", () => {
    expect(readToken()).toBeNull();
    writeToken(token);
    expect(readToken()).toBe(token);
    expect(window.sessionStorage.getItem("namera-admin-token")).toBe(token);
  });

  it("clears the token from storage and from memory", () => {
    writeToken(token);
    clearToken();
    expect(readToken()).toBeNull();
    expect(window.sessionStorage.getItem("namera-admin-token")).toBeNull();
  });

  it("notifies subscribers on every change, and stops after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    writeToken(token);
    clearToken();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    writeToken(token);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("keeps working for this tab when the store is blocked", () => {
    // Private modes throw on access rather than returning null. The token must
    // still serve the current tab, and reads must not crash the app.
    installStorage({
      getItem: () => {
        throw new Error("storage is blocked");
      },
      setItem: () => {
        throw new Error("storage is blocked");
      },
    });
    clearToken();

    expect(() => writeToken(token)).not.toThrow();
    expect(readToken()).toBe(token);
  });

  it("reports signed out when the very first read throws", async () => {
    // A fresh module, so the first read hits storage instead of the cache.
    vi.resetModules();
    installStorage({
      getItem: () => {
        throw new Error("storage is blocked");
      },
    });

    const fresh = await import("../src/lib/session.js");
    expect(fresh.readToken()).toBeNull();
  });
});
