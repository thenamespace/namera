import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { AtomRegistry } from "effect/reactivity";

import { afterEach, expect, it, vi } from "vitest";

import { currentAdminAtom, logoutMutation } from "../../src/atoms/auth";
import { adminRuntime } from "../../src/telemetry";

// Telemetry provides this same layer globally in the running app.
adminRuntime.addGlobalLayer(FetchHttpClient.layer);

const fetchMock = vi.fn<typeof fetch>();
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

it("includes session cookies when the global runtime also provides the fetch layer", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
  vi.stubGlobal("fetch", fetchMock);
  const registry = AtomRegistry.make();
  try {
    await Effect.runPromise(AtomRegistry.getResult(registry, currentAdminAtom));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/internal\/me$/);
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe("include");
  } finally {
    registry.dispose();
  }
});

it("sends logout through the cookie-authenticated API client", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const registry = AtomRegistry.make();
  try {
    registry.set(logoutMutation, {});
    await Effect.runPromise(AtomRegistry.getResult(registry, logoutMutation));
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/auth\/platform\/logout$/);
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe("include");
  } finally {
    registry.dispose();
  }
});
