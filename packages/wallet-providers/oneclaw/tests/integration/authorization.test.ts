import { it, expect } from "@effect/vitest";
import { Effect, Redacted } from "effect";

import { OneClawService } from "../../src/index.js";
import { Live, ProviderHttp, authority, agent } from "../fixtures/provider.js";

const password = Redacted.make("synthetic-password-not-a-live-secret");

it.effect("verifies recovery login against the same customer without reusing its token", () =>
  Effect.gen(function* () {
    const http = yield* ProviderHttp;
    const service = yield* OneClawService;
    http.identity();
    http.respond({ access_token: "recovery-token", expires_in: 300 });
    http.identity();
    yield* service.customers.verifyPassword({ authority, password });
    expect(http.requestAt(1).body).toEqual({
      email: authority.connection.data.email,
      password: Redacted.value(password),
    });
    expect(http.requestAt(2).headers.get("Authorization")).toBe("Bearer recovery-token");
    http.identity();
    yield* service.customers.getIdentity(authority);
    expect(http.requestAt(3).headers.get("Authorization")).toBe("Bearer synthetic-customer-token");
    http.identity();
    http.respond({ access_token: "wrong-identity-token", expires_in: 300 });
    http.respond({ id: "another-customer" });
    expect(
      yield* service.customers.verifyPassword({ authority, password }).pipe(Effect.flip),
    ).toMatchObject({ code: "IDENTITY_MISMATCH" });
  }).pipe(Effect.provide(Live)),
);

it.effect("sets an initial customer password without changing customer authority", () =>
  Effect.gen(function* () {
    const http = yield* ProviderHttp;
    const service = yield* OneClawService;
    http.identity();
    http.respond({ success: true });
    yield* service.customers.setPassword({ authority, password });
    expect(http.requestAt(1).url).toContain("/v1/auth/set-password");
    expect(http.requestAt(1).body).toEqual({
      password: Redacted.value(password),
      password_confirm: Redacted.value(password),
    });
    expect(http.requestAt(1).headers.get("Authorization")).toBe("Bearer synthetic-customer-token");
    expect(http.requestAt(0).headers.get("X-Auth-Confirm")).toBeNull();
  }).pipe(Effect.provide(Live)),
);

it.effect("sends confirmation only to the customer agent PATCH and reads back the policy", () =>
  Effect.gen(function* () {
    const http = yield* ProviderHttp;
    const service = yield* OneClawService;
    http.identity();
    http.respond(agent);
    http.respond(agent);
    yield* service.agents.setRawSigningEnabled({
      authority,
      agentId: "agent",
      enabled: true,
      password,
    });
    expect(http.requestAt(1).url).toMatch(/\/v1\/agents\/agent$/);
    expect(http.requestAt(1).headers.get("X-Auth-Confirm")).toBe(Redacted.value(password));
    expect(http.requestAt(1).body).toEqual({
      raw_signing_enabled: true,
      raw_signing_policy: "allow",
    });
    expect(http.requestAt(0).headers.get("X-Auth-Confirm")).toBeNull();
    expect(http.requestAt(2).headers.get("X-Auth-Confirm")).toBeNull();
  }).pipe(Effect.provide(Live)),
);

it.effect("retains asynchronous approval references without claiming signing is enabled", () =>
  Effect.gen(function* () {
    const http = yield* ProviderHttp;
    const service = yield* OneClawService;
    for (const [body, approval] of [
      [
        { status: "awaiting_approval", approval_id: "approval-1", revision_id: "revision-1" },
        { kind: "guardrail", id: "approval-1" },
      ],
      [
        { status: "pending_approval", pending_approval_id: "approval-2" },
        { kind: "consensus", id: "approval-2" },
      ],
    ] as const) {
      http.identity();
      http.respond(body, 202);
      expect(
        yield* service.agents
          .setRawSigningEnabled({ authority, agentId: "agent", enabled: true, password })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "APPROVAL_REQUIRED", approval });
    }
    expect(http.fetchMock).toHaveBeenCalledTimes(4);
  }).pipe(Effect.provide(Live)),
);
