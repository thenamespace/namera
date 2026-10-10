import { expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

import { AuthError } from "@1claw/sdk";
import { afterEach, beforeEach, vi } from "vitest";

import { OneClawService, fromOneClawException } from "../../src/index.js";
import { fetchMock, Live, respond } from "../fixtures/provider.js";

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it.effect("maps HTTP envelopes to safe errors without retrying", () =>
  Effect.gen(function* () {
    const service = yield* OneClawService;
    for (const [status, code] of [
      [401, "UNAUTHENTICATED"],
      [402, "PAYMENT_REQUIRED"],
      [403, "FORBIDDEN"],
      [404, "NOT_FOUND"],
      [409, "CONFLICT"],
      [429, "RATE_LIMITED"],
      [503, "UNAVAILABLE"],
    ] as const) {
      respond({ type: "test", title: "synthetic-secret", detail: "synthetic-secret" }, status);
      const error = yield* service.connections.get("test").pipe(Effect.flip);
      expect(error.code).toBe(code);
      expect(error.httpStatus).toBe(status);
      expect(JSON.stringify(error)).not.toContain("synthetic-secret");
    }
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(
      JSON.stringify(fromOneClawException("agents.create", new AuthError("synthetic-secret", 403))),
    ).not.toContain("synthetic-secret");
  }).pipe(Effect.provide(Live)),
);

it.effect("sanitizes transport exceptions and malformed JSON", () =>
  Effect.gen(function* () {
    const service = yield* OneClawService;
    fetchMock.mockRejectedValueOnce(new Error("synthetic-secret"));
    const error = yield* service.connections.get("test").pipe(Effect.flip);
    expect(error.code).toBe("UNAVAILABLE");
    expect(JSON.stringify(error)).not.toContain("synthetic-secret");
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200 }));
    expect((yield* service.connections.get("test").pipe(Effect.flip)).code).toBe(
      "INVALID_RESPONSE",
    );
  }).pipe(Effect.provide(Live)),
);

it.effect("bounds waiting without silently retrying an unresolved SDK request", () =>
  Effect.gen(function* () {
    const service = yield* OneClawService;
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    const fiber = yield* service.connections.get("test").pipe(Effect.flip, Effect.forkChild);
    yield* TestClock.adjust("2 seconds");
    expect((yield* Fiber.join(fiber)).code).toBe("TIMEOUT");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }).pipe(Effect.provide(Live)),
);
