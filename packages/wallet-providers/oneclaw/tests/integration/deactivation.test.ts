import { expect, it } from "@effect/vitest";
import { DateTime, Effect } from "effect";

import { OneClawService } from "../../src/index.js";
import { account, authority, key, Live, ProviderHttp } from "../fixtures/provider.js";

const input = {
  authority,
  agentId: "agent",
  key: { id: "key", version: 1, publicKey: account.publicKey },
};

it.effect("deactivates the pinned Ethereum key with customer-scoped authority", () =>
  Effect.gen(function* () {
    const { identity, respond, requestAt, fetchMock } = yield* ProviderHttp;
    const service = yield* OneClawService;
    identity();
    respond({ keys: [key] });
    respond(null, 204);
    yield* service.signingKeys.deactivate(input);
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe("DELETE");
    expect(requestAt(2).url).toBe("https://api.1claw.co/v1/agents/agent/signing-keys/ethereum");
    expect(requestAt(2).headers.get("Authorization")).toBe("Bearer synthetic-customer-token");
    expect(requestAt(2).headers.has("X-Platform-Connection")).toBe(false);
  }).pipe(Effect.provide(Live)),
);

it.effect.each([
  { name: "replacement key", change: { id: "replacement" } },
  { name: "rotated version", change: { key_version: 2 } },
  { name: "wrong agent", change: { agent_id: "other" } },
  { name: "threshold custody", change: { custody: "client_tss" } },
] as const)("never deletes a $name", ({ change }) =>
  Effect.gen(function* () {
    const { identity, respond, fetchMock } = yield* ProviderHttp;
    const service = yield* OneClawService;
    identity();
    respond({ keys: [{ ...key, ...change }] });
    expect((yield* service.signingKeys.deactivate(input).pipe(Effect.flip)).code).toBe(
      "KEY_MISMATCH",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }).pipe(Effect.provide(Live)),
);

it.effect("reconciles an uncertain DELETE by listing instead of deleting again", () =>
  Effect.gen(function* () {
    const { identity, respond, fetchMock } = yield* ProviderHttp;
    const service = yield* OneClawService;
    identity();
    respond({ keys: [key] });
    fetchMock.mockRejectedValueOnce(new Error("Lost response"));
    yield* service.signingKeys.deactivate(input).pipe(Effect.flip);

    identity();
    respond({ keys: [] });
    yield* service.signingKeys.deactivate(input);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(1);
  }).pipe(Effect.provide(Live)),
);

it.effect("refuses changed public material and ambiguous active key lists", () =>
  Effect.gen(function* () {
    const { identity, respond, fetchMock } = yield* ProviderHttp;
    const service = yield* OneClawService;
    identity();
    respond({ keys: [key] });
    expect(
      (yield* service.signingKeys
        .deactivate({
          ...input,
          key: { ...input.key, publicKey: `0x${"04".repeat(65)}` },
        })
        .pipe(Effect.flip)).code,
    ).toBe("KEY_MISMATCH");
    identity();
    respond({ keys: [key, key] });
    expect((yield* service.signingKeys.deactivate(input).pipe(Effect.flip)).code).toBe(
      "KEY_MISMATCH",
    );
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  }).pipe(Effect.provide(Live)),
);

it.effect("does not treat a missing agent or denied lookup as confirmed deactivation", () =>
  Effect.gen(function* () {
    const { identity, respond, fetchMock } = yield* ProviderHttp;
    const service = yield* OneClawService;
    for (const [status, code] of [
      [404, "NOT_FOUND"],
      [403, "FORBIDDEN"],
    ] as const) {
      identity();
      respond({ type: "error", detail: "synthetic-secret" }, status);
      const error = yield* service.signingKeys.deactivate(input).pipe(Effect.flip);
      expect(error.code).toBe(code);
      expect(JSON.stringify(error)).not.toContain("synthetic-secret");
    }
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  }).pipe(Effect.provide(Live)),
);

it.effect("rejects expired and wrong-customer authority before destructive calls", () =>
  Effect.gen(function* () {
    const { respond, fetchMock } = yield* ProviderHttp;
    const service = yield* OneClawService;
    const expiresAt = DateTime.makeUnsafe(0);
    const expired = {
      ...authority,
      credential: { ...authority.credential, expiresAt },
      payload: { ...authority.payload, expiresAt },
    };
    expect(
      (yield* service.signingKeys.deactivate({ ...input, authority: expired }).pipe(Effect.flip))
        .code,
    ).toBe("AUTHORITY_EXPIRED");
    expect(fetchMock).not.toHaveBeenCalled();
    respond({ id: "another-customer" });
    expect((yield* service.signingKeys.deactivate(input).pipe(Effect.flip)).code).toBe(
      "IDENTITY_MISMATCH",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }).pipe(Effect.provide(Live)),
);
