import { expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

import { AuthError } from "@1claw/sdk";

import { OneClawService, fromOneClawException } from "../../src/index.js";
import { ProviderHttp, Live } from "../fixtures/provider.js";

it.effect.each([
  [401, "UNAUTHENTICATED"],
  [402, "PAYMENT_REQUIRED"],
  [403, "FORBIDDEN"],
  [404, "NOT_FOUND"],
  [409, "CONFLICT"],
  [429, "RATE_LIMITED"],
  [503, "UNAVAILABLE"],
] as const)("maps HTTP %i to %s without leaking provider text or retrying", ([status, code]) =>
  Effect.gen(function* () {
    const { fetchMock, respond } = yield* ProviderHttp;
    const service = yield* OneClawService;
    respond({ type: "test", title: "synthetic-secret", detail: "synthetic-secret" }, status);
    const error = yield* service.connections.get("test").pipe(Effect.flip);
    expect(error).toMatchObject({ code, httpStatus: status, operation: "connections.get" });
    expect(JSON.stringify(error)).not.toContain("synthetic-secret");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }).pipe(Effect.provide(Live)),
);

it("removes provider text from thrown SDK authentication errors", () => {
  const error = fromOneClawException("agents.create", new AuthError("synthetic-secret", 403));
  expect(error).toMatchObject({ code: "FORBIDDEN", operation: "agents.create", httpStatus: 403 });
  expect(JSON.stringify(error)).not.toContain("synthetic-secret");
});

it.effect("sanitizes transport exceptions and malformed JSON", () =>
  Effect.gen(function* () {
    const { fetchMock } = yield* ProviderHttp;
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
    const { fetchMock } = yield* ProviderHttp;
    const service = yield* OneClawService;
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    const fiber = yield* service.connections.get("test").pipe(Effect.flip, Effect.forkChild);
    yield* TestClock.adjust("31 seconds");
    expect((yield* Fiber.join(fiber)).code).toBe("TIMEOUT");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }).pipe(Effect.provide(Live)),
);
