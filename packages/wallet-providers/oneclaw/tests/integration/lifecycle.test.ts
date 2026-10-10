import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Option, Redacted, Ref } from "effect";

import { afterEach, beforeEach, vi } from "vitest";

import { OneClawService, oneClawTestLayer, OneClawTestControl } from "../../src/index.js";
import {
  agent,
  authority,
  claim,
  fetchMock,
  identity,
  key,
  Live,
  provisioning,
  remoteConnection,
  requestAt,
  respond,
  setup,
  template,
} from "../fixtures/provider.js";

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it.effect("empty setup returns only a protected claim using the configured template", () =>
  Effect.gen(function* () {
    respond(template);
    respond(remoteConnection);
    respond({ ...claim, summary: { vault_id: null, agent_id: null, policy_ids: [] } });
    const service = yield* OneClawService;
    const result = yield* service.connections.bootstrapEmpty(setup);
    expect(result.connectionId).toBe("connection");
    expect(Redacted.value(result.token)).toBe("synthetic-claim");
    expect(JSON.stringify(result)).not.toContain("synthetic-claim");
    expect(requestAt(2).body).toEqual({ template_id: "empty-template" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }).pipe(Effect.provide(Live)),
);

it.effect("rejects template drift before bootstrap and unexpected resources afterwards", () =>
  Effect.gen(function* () {
    const service = yield* OneClawService;
    for (const change of [
      { spec: { agents: [] } },
      { version: 2 },
      { platform_app_id: "other" },
      { is_active: false },
    ]) {
      respond({ ...template, ...change });
      expect((yield* service.connections.bootstrapEmpty(setup).pipe(Effect.flip)).code).toBe(
        "TEMPLATE_MISMATCH",
      );
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
    respond(template);
    respond(remoteConnection);
    respond({ ...claim, summary: { agent_id: "unexpected" } });
    expect((yield* service.connections.bootstrapEmpty(setup).pipe(Effect.flip)).code).toBe(
      "UNEXPECTED_RESOURCES",
    );
  }).pipe(Effect.provide(Live)),
);

it.effect("redeems renewed claims with verified customer identity and explicit expiration", () =>
  Effect.gen(function* () {
    const service = yield* OneClawService;
    respond(claim);
    const renewed = yield* service.connections.reissueClaim("connection");
    respond({
      connection_id: "connection",
      auth_token: "synthetic-customer-token",
      expires_in: 86400,
    });
    identity();
    const session = yield* service.customers.redeemClaim({
      claim: renewed,
      expectedCustomerId: "customer",
    });
    expect(session.customerId).toBe("customer");
    expect(JSON.stringify(session)).not.toContain("synthetic-customer-token");
    expect(requestAt(1).headers.has("Authorization")).toBe(false);
    expect(requestAt(2).headers.get("Authorization")).toBe("Bearer synthetic-customer-token");
    respond({
      connection_id: "connection",
      auth_token: "wrong-customer-secret",
      expires_in: 86400,
    });
    respond({ id: "other" });
    expect(
      (yield* service.customers
        .redeemClaim({ claim: renewed, expectedCustomerId: "customer" })
        .pipe(Effect.flip)).code,
    ).toBe("IDENTITY_MISMATCH");
    respond({ connection_id: "connection", auth_token: "synthetic-customer-token" });
    expect(
      (yield* service.customers
        .redeemClaim({ claim: renewed, expectedCustomerId: "customer" })
        .pipe(Effect.flip)).code,
    ).toBe("INVALID_RESPONSE");
  }).pipe(Effect.provide(Live)),
);

it.effect(
  "creates successive agents through the same delegated path and keys with customer auth",
  () =>
    Effect.gen(function* () {
      const service = yield* OneClawService;
      identity();
      respond(null, 204);
      respond({ agents: [] });
      yield* service.customers.enableDelegation(authority);
      expect(requestAt(1).body).toEqual({
        delegation_enabled: true,
        delegation_scopes: ["agents:read", "agents:write"],
      });
      for (const id of ["first", "second"]) {
        identity();
        respond({ agent: { ...agent, id }, api_key: `synthetic-${id}-key` });
        const created = yield* service.agents.create({
          request: provisioning,
          authority,
          name: id,
        });
        expect(created.credential.agentId).toBe(id);
        expect(JSON.stringify(created)).not.toContain(`synthetic-${id}-key`);
        const creation = requestAt(fetchMock.mock.calls.length - 1);
        expect(creation.headers.get("X-Platform-Connection")).toBe("connection");
        expect(creation.headers.get("Authorization")).toBe("Bearer synthetic-platform-key");
        identity();
        respond({ ...key, agent_id: id });
        expect((yield* service.signingKeys.create({ authority, agentId: id })).agentId).toBe(id);
        expect(requestAt(fetchMock.mock.calls.length - 1).headers.get("Authorization")).toBe(
          "Bearer synthetic-customer-token",
        );
      }
    }).pipe(Effect.provide(Live)),
);

it.effect("rejects expired, mismatched customer authority and denied delegation", () =>
  Effect.gen(function* () {
    const service = yield* OneClawService;
    const expiresAt = DateTime.makeUnsafe(0);
    const expired = {
      ...authority,
      credential: { ...authority.credential, expiresAt },
      payload: { ...authority.payload, expiresAt },
    };
    expect((yield* service.customers.getIdentity(expired).pipe(Effect.flip)).code).toBe(
      "AUTHORITY_EXPIRED",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    respond({ id: "other-customer" });
    expect((yield* service.customers.enableDelegation(authority).pipe(Effect.flip)).code).toBe(
      "IDENTITY_MISMATCH",
    );
    identity();
    respond({ type: "forbidden", detail: "synthetic-secret" }, 403);
    const error = yield* service.customers.enableDelegation(authority).pipe(Effect.flip);
    expect(error.code).toBe("FORBIDDEN");
    expect(JSON.stringify(error)).not.toContain("synthetic-secret");
  }).pipe(Effect.provide(Live)),
);

it.effect("handles SDK 409 data envelopes and ambiguous subject recovery", () =>
  Effect.gen(function* () {
    const service = yield* OneClawService;
    respond({ link_required: { status: "link_required" } }, 409);
    expect(
      (yield* service.connections
        .upsert({ subjectToken: Redacted.make("synthetic-oidc"), displayName: "test" })
        .pipe(Effect.flip)).code,
    ).toBe("LINK_REQUIRED");
    const user = { ...remoteConnection, external_subject: "namera:org:test" };
    respond({ users: [user] });
    expect(
      Option.getOrThrow(yield* service.connections.findBySubject("namera:org:test")).connectionId,
    ).toBe("connection");
    respond({ users: [user, { ...user, connection_id: "duplicate" }] });
    expect(
      (yield* service.connections.findBySubject("namera:org:test").pipe(Effect.flip)).code,
    ).toBe("RECOVERY_AMBIGUOUS");
  }).pipe(Effect.provide(Live)),
);

it.effect("test layer observes calls and explicitly rejects unconfigured operations", () =>
  Effect.gen(function* () {
    const service = yield* OneClawService;
    yield* service.connections.findBySubject("test");
    expect((yield* service.signingKeys.destroy().pipe(Effect.flip)).code).toBe("UNSUPPORTED");
    const control = yield* OneClawTestControl;
    expect(yield* Ref.get(control.calls)).toEqual([
      "connections.findBySubject",
      "signingKeys.destroy",
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  }).pipe(Effect.provide(oneClawTestLayer())),
);
