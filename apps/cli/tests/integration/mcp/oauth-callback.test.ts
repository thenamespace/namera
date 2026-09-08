import { Deferred, Effect, Fiber, Ref, Result } from "effect";
import { TestClock } from "effect/testing";

import { describe, expect, it } from "vitest";

import { LocalOAuthError } from "../../../src/services/mcp/oauth-contracts.js";
import { makeMcpOAuthFixture, mcpTestLayer } from "../../fixtures/mcp-oauth.js";

describe("local MCP callback recovery", () => {
  it("requires new consent after an ambiguous upstream exchange failure", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const unavailable = yield* Ref.make(true);
        const fixture = yield* makeMcpOAuthFixture({
          beforeExchange: Effect.gen(function* () {
            if (yield* Ref.get(unavailable))
              return yield* new LocalOAuthError({ code: "temporarily_unavailable" });
          }),
        });
        const redirect = new URL(yield* fixture.broker.begin(fixture.authorization));
        const state = redirect.searchParams.get("state") ?? "";
        const first = yield* fixture.broker.callback(state, "upstream-code").pipe(Effect.result);
        expect(Result.isFailure(first) && first.failure).toMatchObject({
          _tag: "LocalOAuthError",
          code: "temporarily_unavailable",
        });

        yield* Ref.set(unavailable, false);
        const replay = yield* fixture.broker.callback(state, "upstream-code").pipe(Effect.result);
        expect(Result.isFailure(replay) && replay.failure).toMatchObject({
          _tag: "LocalOAuthError",
          code: "invalid_grant",
        });
        expect(Result.isFailure(yield* fixture.broker.deny(state).pipe(Effect.result))).toBe(true);
        expect(yield* Ref.get(fixture.exchanges)).toHaveLength(1);

        const tokens = yield* fixture.login;
        expect((yield* fixture.broker.authenticate(tokens.access_token)).clientId).toBe(
          fixture.client.client_id,
        );
        expect(yield* Ref.get(fixture.exchanges)).toHaveLength(2);
      }).pipe(Effect.provide(mcpTestLayer)),
    ));

  it("does not issue a local code when consent expires during the upstream exchange", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        const fixture = yield* makeMcpOAuthFixture({
          beforeExchange: Effect.gen(function* () {
            yield* Deferred.succeed(started, undefined);
            yield* Deferred.await(release);
          }),
        });
        const redirect = new URL(yield* fixture.broker.begin(fixture.authorization));
        const state = redirect.searchParams.get("state") ?? "";
        const pending = yield* Effect.forkChild(
          fixture.broker.callback(state, "upstream-code").pipe(Effect.result),
        );
        yield* Deferred.await(started);

        expect(
          Result.isFailure(yield* fixture.broker.callback(state, "other-code").pipe(Effect.result)),
        ).toBe(true);
        expect(Result.isFailure(yield* fixture.broker.deny(state).pipe(Effect.result))).toBe(true);
        yield* TestClock.adjust("10 minutes");
        yield* Deferred.succeed(release, undefined);
        const result = yield* Fiber.join(pending);
        expect(Result.isFailure(result) && result.failure).toMatchObject({
          _tag: "LocalOAuthError",
          code: "invalid_grant",
        });
        expect(yield* Ref.get(fixture.exchanges)).toHaveLength(1);
        expect(
          Result.isFailure(
            yield* fixture.broker.callback(state, "upstream-code").pipe(Effect.result),
          ),
        ).toBe(true);
      }).pipe(Effect.provide(mcpTestLayer)),
    ));
});
