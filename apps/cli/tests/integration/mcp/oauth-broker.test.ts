import { createHash } from "node:crypto";

import { Deferred, Effect, Fiber, Redacted, Ref, Result } from "effect";
import { TestClock } from "effect/testing";

import { describe, expect, it } from "vitest";

import {
  apiOrigin,
  challenge,
  makeMcpOAuthFixture,
  mcpTestLayer,
  urls,
} from "../../fixtures/mcp-oauth.js";

describe("local MCP OAuth broker", () => {
  it("does not resurrect a grant revoked during an upstream refresh", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        const fixture = yield* makeMcpOAuthFixture({
          beforeRefresh: Effect.gen(function* () {
            yield* Deferred.succeed(started, undefined);
            yield* Deferred.await(release);
          }),
        });
        const tokens = yield* fixture.login;
        const refreshing = yield* Effect.forkChild(
          fixture.broker
            .refresh({
              grant_type: "refresh_token",
              client_id: fixture.client.client_id,
              resource: urls.resource,
              refresh_token: tokens.refresh_token,
            })
            .pipe(Effect.result),
        );
        yield* Deferred.await(started);
        expect(
          Result.isFailure(
            yield* fixture.broker.authenticate(tokens.access_token).pipe(Effect.result),
          ),
        ).toBe(true);
        yield* fixture.broker.revoke(fixture.client.client_id, tokens.refresh_token ?? "");
        yield* Deferred.succeed(release, undefined);
        expect(Result.isFailure(yield* Fiber.join(refreshing))).toBe(true);
        expect(yield* Ref.get(fixture.revocations)).toBe(1);
      }).pipe(Effect.provide(mcpTestLayer)),
    ));

  it("uses independent PKCE, state, codes and tokens for the API and local audiences", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fixture = yield* makeMcpOAuthFixture();
        const { broker, authorization } = fixture;
        const redirect = new URL(yield* broker.begin(authorization));
        expect(redirect.origin).toBe(apiOrigin);
        expect(redirect.searchParams.get("resource")).toBe(apiOrigin);
        expect(redirect.searchParams.get("redirect_uri")).toBe(urls.callback);
        expect(redirect.searchParams.get("code_challenge")).not.toBe(challenge);
        expect(redirect.searchParams.get("state")).not.toBe(authorization.state);

        const callback = new URL(
          yield* broker.callback(redirect.searchParams.get("state") ?? "", "upstream-code"),
        );
        expect(callback.searchParams.get("state")).toBe("agent-state");
        expect(callback.searchParams.get("code")).not.toBe("upstream-code");
        const observations = yield* Ref.get(fixture.exchanges);
        expect(
          createHash("sha256")
            .update(observations[0]?.verifier ?? "")
            .digest("base64url"),
        ).toBe(redirect.searchParams.get("code_challenge"));
        expect(observations[0]?.clientId).toBe("upstream-agent");

        const tokens = yield* fixture.login;
        expect(tokens.access_token).not.toBe("upstream-access-token");
        expect(tokens.refresh_token).not.toBe("upstream-refresh-token");
        expect(tokens.expires_in).toBe(300);
        const principal = yield* broker.authenticate(tokens.access_token);
        expect(Redacted.value(principal.accessToken)).toBe("upstream-access-token");
        expect(JSON.stringify(principal)).not.toContain("upstream-access-token");
        expect(JSON.stringify(tokens)).not.toContain("upstream-");
        expect(
          Result.isFailure(yield* broker.authenticate("upstream-access-token").pipe(Effect.result)),
        ).toBe(true);
        expect(
          Result.isFailure(
            yield* broker.authenticate(tokens.refresh_token ?? "").pipe(Effect.result),
          ),
        ).toBe(true);
      }).pipe(Effect.provide(mcpTestLayer)),
    ));

  it("rejects unregistered redirects, wrong audiences, and unsupported scopes before authorization", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { broker, authorization } = yield* makeMcpOAuthFixture();
        for (const override of [
          { client_id: "unknown" },
          { redirect_uri: "https://evil.example/callback" },
          { resource: apiOrigin },
          { scope: "mcp:read wallet:admin" },
          { code_challenge_method: "plain" },
          { scope: "mcp:execute" },
        ]) {
          const result = yield* broker.begin({ ...authorization, ...override }).pipe(Effect.result);
          expect(Result.isFailure(result)).toBe(true);
        }
      }).pipe(Effect.provide(mcpTestLayer)),
    ));

  it("consumes upstream callbacks and authorization codes exactly once under concurrency", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { broker, authorization, exchanges, makeCode } = yield* makeMcpOAuthFixture();
        const redirect = new URL(yield* broker.begin(authorization));
        const callback = broker
          .callback(redirect.searchParams.get("state") ?? "", "upstream-code")
          .pipe(Effect.result);
        const callbacks = yield* Effect.all([callback, callback], { concurrency: "unbounded" });
        expect(callbacks.filter(Result.isSuccess)).toHaveLength(1);
        expect(yield* Ref.get(exchanges)).toHaveLength(1);
        const code = yield* makeCode;
        const exchange = broker.exchange(code).pipe(Effect.result);
        const results = yield* Effect.all([exchange, exchange], { concurrency: "unbounded" });
        expect(results.filter(Result.isSuccess)).toHaveLength(1);
      }).pipe(Effect.provide(mcpTestLayer)),
    ));

  it("binds code exchange to client, redirect, resource and verifier, burning invalid attempts", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { broker, makeCode } = yield* makeMcpOAuthFixture();
        for (const override of [
          { client_id: "another-client" },
          { redirect_uri: "https://evil.example/callback" },
          { resource: apiOrigin },
          { code_verifier: "x".repeat(43) },
        ]) {
          const code = yield* makeCode;
          expect(
            Result.isFailure(yield* broker.exchange({ ...code, ...override }).pipe(Effect.result)),
          ).toBe(true);
          expect(Result.isFailure(yield* broker.exchange(code).pipe(Effect.result))).toBe(true);
        }
      }).pipe(Effect.provide(mcpTestLayer)),
    ));

  it("expires authorization state, codes and access tokens on the test clock", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { broker, authorization, makeCode, login } = yield* makeMcpOAuthFixture();
        const redirect = new URL(yield* broker.begin(authorization));
        yield* TestClock.adjust("10 minutes");
        expect(
          Result.isFailure(
            yield* broker
              .callback(redirect.searchParams.get("state") ?? "", "code")
              .pipe(Effect.result),
          ),
        ).toBe(true);
        const code = yield* makeCode;
        yield* TestClock.adjust("1 minute");
        expect(Result.isFailure(yield* broker.exchange(code).pipe(Effect.result))).toBe(true);
        const tokens = yield* login;
        yield* TestClock.adjust("5 minutes");
        expect(
          Result.isFailure(yield* broker.authenticate(tokens.access_token).pipe(Effect.result)),
        ).toBe(true);
      }).pipe(Effect.provide(mcpTestLayer)),
    ));

  it("rotates refresh tokens once, invalidates old access, and cannot regain narrowed scopes", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { broker, login, client, refreshes } = yield* makeMcpOAuthFixture();
        const tokens = yield* login;
        const input = {
          grant_type: "refresh_token",
          client_id: client.client_id,
          resource: urls.resource,
          refresh_token: tokens.refresh_token,
          scope: "mcp:read offline_access",
        };
        const results = yield* Effect.all(
          [broker.refresh(input).pipe(Effect.result), broker.refresh(input).pipe(Effect.result)],
          { concurrency: "unbounded" },
        );
        expect(results.filter(Result.isSuccess)).toHaveLength(1);
        expect(yield* Ref.get(refreshes)).toBe(1);
        expect(
          Result.isFailure(yield* broker.authenticate(tokens.access_token).pipe(Effect.result)),
        ).toBe(true);
        const success = results.find(Result.isSuccess);
        if (!success) throw new Error("Expected a rotated token");
        expect(success.success.scope).toBe("mcp:read offline_access");
        expect((yield* broker.authenticate(success.success.access_token)).scopes).not.toContain(
          "mcp:execute",
        );
        expect(
          Result.isFailure(
            yield* broker
              .refresh({
                ...input,
                refresh_token: success.success.refresh_token,
                scope: "mcp:read mcp:execute offline_access",
              })
              .pipe(Effect.result),
          ),
        ).toBe(true);
        yield* broker.revoke(client.client_id, success.success.refresh_token ?? "");
        expect(
          Result.isFailure(
            yield* broker.authenticate(success.success.access_token).pipe(Effect.result),
          ),
        ).toBe(true);
      }).pipe(Effect.provide(mcpTestLayer)),
    ));
});
