import { expect, layer } from "@effect/vitest";
import { Effect, Ref, Result } from "effect";
import { TestClock } from "effect/testing";

import { Database, Repository, credentials, signingKey } from "@namera-ai/database";
import { OneClawTestControl, oneClawAccountTestLayer } from "@namera-ai/wallet-provider-oneclaw";

import {
  createMember,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";

const Live = makeTestServerLayer(
  {},
  undefined,
  makeTestConfigLayer({
    ONECLAW_PLATFORM_APP_ID: "test-app",
    ONECLAW_ORG_EMAIL_DOMAIN: "example.invalid",
  }),
  undefined,
  oneClawAccountTestLayer(),
);
const request = {
  payload: {
    namespace: "eip155" as const,
    owner: { type: "namera-managed" as const, provider: "1claw" as const },
    metadata: { version: 1 as const, name: "Managed account" },
  },
};
const setup = Effect.gen(function* () {
  yield* resetTestState();
  // Lease and credential constraints use the database's real clock.
  yield* TestClock.setTime(Date.now());
  const control = yield* OneClawTestControl;
  yield* Ref.set(control.calls, []);
  yield* Ref.set(control.failNext, undefined);
  const client = yield* makeTestApiClient;
  const actor = yield* signIn(client, testEmail(`${crypto.randomUUID()}@example.com`));
  return {
    client,
    organizationId: actor.actor.organization.id,
    control,
    repository: yield* Repository,
  };
});

layer(Live)("1Claw managed account creation", (it) => {
  it.effect(
    "reuses one org connection, saves encrypted credentials and enforces Free v2 capacity",
    () =>
      Effect.gen(function* () {
        const { client, organizationId, repository, control } = yield* setup;
        const first = yield* client.wallet.create(request);
        expect(first.owner).toMatchObject({ custody: "namera-managed", provider: "1claw" });
        expect(first.data).toMatchObject({
          accountMode: "factory",
          validatorType: "ecdsa_secp256k1",
        });
        const stored = yield* repository.core.wallet.findById(first.id, organizationId);
        expect(stored?.signingKey.data.type).toBe("1claw");
        const connection = yield* repository.core.providerConnections.findByOrganization(
          organizationId,
          "test-app",
        );
        expect(connection?.status).toBe("ready");
        if (!stored?.signingKey.credentialId || !connection?.customerCredentialId)
          return yield* Effect.die("Missing persisted account bindings");
        for (const id of [stored.signingKey.credentialId, connection.customerCredentialId]) {
          const credential = yield* repository.core.credentials.findById(id, organizationId);
          expect(credential?.encryptedPayload).toBeTruthy();
          expect(credential?.encryptedPayload).not.toContain("test-agent-key");
          expect(credential?.encryptedPayload).not.toContain("test-customer-token");
        }
        expect(
          JSON.stringify(first, (_, value) => (typeof value === "bigint" ? String(value) : value)),
        ).not.toMatch(/credentialId|agentId|providerKeyId|test-agent-key/);
        yield* client.wallet.create(request);
        yield* client.wallet.create(request);
        const calls = yield* Ref.get(control.calls);
        expect(calls.filter((op) => op === "connections.bootstrapEmpty")).toHaveLength(1);
        expect(calls.filter((op) => op === "customers.enableDelegation")).toHaveLength(1);
        expect(calls.filter((op) => op === "agents.create")).toHaveLength(3);
        const error = yield* client.wallet.create(request).pipe(Effect.flip);
        expect(error).toMatchObject({ _tag: "BillingError" });
        expect(yield* Ref.get(control.calls)).toEqual(calls);
        expect(yield* client.wallet.list()).toHaveLength(3);
        const audit = yield* repository.audit.organization.findForOrganization(organizationId);
        expect(audit.filter((event) => event.event === "wallet.created")).toHaveLength(3);
        expect(audit.filter((event) => event.event === "provider_credential.saved")).toHaveLength(
          4,
        );
      }),
  );

  it.effect("does not repeat an ambiguous bootstrap", () =>
    Effect.gen(function* () {
      const { client, control, organizationId, repository } = yield* setup;
      yield* Ref.set(control.failNext, "connections.bootstrapEmpty");
      expect(yield* client.wallet.create(request).pipe(Effect.flip)).toMatchObject({
        _tag: "WalletCreationError",
      });
      expect(yield* client.wallet.create(request).pipe(Effect.flip)).toMatchObject({
        code: "PROVIDER_RECOVERY_REQUIRED",
      });
      const calls = yield* Ref.get(control.calls);
      expect(calls.filter((op) => op === "connections.bootstrapEmpty")).toHaveLength(1);
      expect(calls).not.toContain("agents.create");
      expect(yield* client.wallet.list()).toEqual([]);
      const connection = yield* repository.core.providerConnections.findByOrganization(
        organizationId,
        "test-app",
      );
      expect(connection?.data.bootstrapAttemptedAt).toBeDefined();
      expect(connection?.data.bootstrapCompletedAt).toBeNull();
    }),
  );

  it.effect("retains the one-time agent credential when wallet provisioning fails", () =>
    Effect.gen(function* () {
      const { client, control, repository, organizationId } = yield* setup;
      yield* Ref.set(control.failNext, "signingKeys.create");
      expect(yield* client.wallet.create(request).pipe(Effect.flip)).toMatchObject({
        code: "PROVIDER_RECOVERY_REQUIRED",
      });
      expect(yield* client.wallet.list()).toEqual([]);
      const events = yield* repository.audit.organization.findForOrganization(organizationId);
      const saved = events.filter(
        (event) => event.event === "provider_credential.saved" && event.data.type === "1claw-agent",
      );
      expect(saved).toHaveLength(1);
      expect(events.some((event) => event.event === "wallet.created")).toBe(false);
      yield* client.wallet.create(request);
      expect(
        (yield* Ref.get(control.calls)).filter((op) => op === "connections.bootstrapEmpty"),
      ).toHaveLength(1);
    }),
  );

  it.effect("keeps GCP disabled even when 1Claw is present", () =>
    Effect.gen(function* () {
      const { client, control } = yield* setup;
      expect(
        yield* client.wallet
          .create({
            payload: {
              ...request.payload,
              owner: { type: "namera-managed", protectionLevel: "hsm" },
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "MANAGED_WALLETS_DISABLED" });
      expect(yield* Ref.get(control.calls)).toEqual([]);
    }),
  );

  it.effect(
    "rolls back local account state after provider success while retaining recovery credentials",
    () =>
      Effect.gen(function* () {
        const { client, repository, organizationId, control } = yield* setup;
        const db = yield* Database;
        yield* db.execute(
          "ALTER TABLE core.wallet ADD CONSTRAINT phase6_reject_insert CHECK (false) NOT VALID",
        );
        yield* Effect.gen(function* () {
          expect(yield* client.wallet.create(request).pipe(Effect.flip)).toMatchObject({
            code: "WALLET_PERSISTENCE_FAILED",
          });
          expect(yield* client.wallet.list()).toEqual([]);
          expect(yield* db.select().from(signingKey)).toEqual([]);
          expect(yield* db.select().from(credentials)).toHaveLength(2);
          const events = yield* repository.audit.organization.findForOrganization(organizationId);
          expect(
            events.some(
              (event) => event.event === "wallet.created" || event.event === "signing_key.created",
            ),
          ).toBe(false);
          expect(
            (yield* client.notification.list({ query: {} })).items.some(
              (entry) => entry.notification.type === "wallet.created",
            ),
          ).toBe(false);
          expect(yield* Ref.get(control.calls)).toContain("agents.setRawSigningEnabled");
        }).pipe(
          Effect.ensuring(
            db
              .execute("ALTER TABLE core.wallet DROP CONSTRAINT phase6_reject_insert")
              .pipe(Effect.orDie),
          ),
        );
      }),
  );

  it.effect("does not renew a tampered customer credential", () =>
    Effect.gen(function* () {
      const { client, control } = yield* setup;
      yield* client.wallet.create(request);
      yield* (yield* Database).execute(
        "UPDATE core.credentials SET encrypted_payload = 'tampered' WHERE type = '1claw-customer'",
      );
      yield* TestClock.adjust("25 hours");
      yield* Ref.set(control.calls, []);
      expect(yield* client.wallet.create(request).pipe(Effect.flip)).toMatchObject({
        code: "PROVIDER_SETUP_FAILED",
      });
      expect(yield* Ref.get(control.calls)).toEqual([]);
      expect(yield* client.wallet.list()).toHaveLength(1);
    }),
  );

  it.effect("checks user permissions before any provider operation", () =>
    Effect.gen(function* () {
      const { client, control } = yield* setup;
      const member = yield* createMember(client, testEmail(`${crypto.randomUUID()}@example.com`));
      yield* setAuthToken(member.memberToken);
      expect(yield* client.wallet.create(request).pipe(Effect.flip)).toMatchObject({
        _tag: "Forbidden",
      });
      expect(yield* Ref.get(control.calls)).toEqual([]);
    }),
  );

  it.effect("limits failed creation attempts before provisioning more remote resources", () =>
    Effect.gen(function* () {
      const { client, control } = yield* setup;
      yield* Ref.set(control.failNext, "connections.bootstrapEmpty");
      for (let index = 0; index < 20; index++)
        yield* client.wallet.create(request).pipe(Effect.flip);
      expect(yield* client.wallet.create(request).pipe(Effect.flip)).toMatchObject({
        _tag: "RateLimitExceeded",
      });
      expect(
        (yield* Ref.get(control.calls)).filter((op) => op === "connections.bootstrapEmpty"),
      ).toHaveLength(1);
    }),
  );

  it.effect("renews expired customer authority without repeating bootstrap or delegation", () =>
    Effect.gen(function* () {
      const { client, control, repository, organizationId } = yield* setup;
      yield* client.wallet.create(request);
      const before = yield* repository.core.providerConnections.findByOrganization(
        organizationId,
        "test-app",
      );
      yield* TestClock.adjust("25 hours");
      yield* client.wallet.create(request);
      const after = yield* repository.core.providerConnections.findByOrganization(
        organizationId,
        "test-app",
      );
      expect(after?.customerCredentialId).toBe(before?.customerCredentialId);
      const calls = yield* Ref.get(control.calls);
      expect(calls.filter((op) => op === "connections.bootstrapEmpty")).toHaveLength(1);
      expect(calls.filter((op) => op === "customers.redeemClaim")).toHaveLength(2);
      expect(calls.filter((op) => op === "customers.enableDelegation")).toHaveLength(1);
    }),
  );

  it.effect("rejects a disabled org connection before creating another agent", () =>
    Effect.gen(function* () {
      const { client, control, repository, organizationId } = yield* setup;
      yield* client.wallet.create(request);
      const connection = yield* repository.core.providerConnections.findByOrganization(
        organizationId,
        "test-app",
      );
      if (!connection) return yield* Effect.die("Missing connection");
      yield* repository.core.providerConnections.disable({ id: connection.id, organizationId });
      yield* Ref.set(control.calls, []);
      expect(yield* client.wallet.create(request).pipe(Effect.flip)).toMatchObject({
        _tag: "WalletCreationError",
      });
      expect(yield* Ref.get(control.calls)).toEqual([]);
    }),
  );

  if (process.env.NAMERA_TEST_POSTGRES_PORT !== undefined) {
    it.effect(
      "serializes concurrent org setup and cannot overfill the last managed-account slot",
      () =>
        Effect.gen(function* () {
          const { client, control } = yield* setup;
          const first = yield* Effect.all(
            Array.from({ length: 5 }, () => client.wallet.create(request).pipe(Effect.result)),
            { concurrency: "unbounded" },
          );
          expect(first.some(Result.isSuccess)).toBe(true);
          expect(
            (yield* Ref.get(control.calls)).filter((op) => op === "connections.bootstrapEmpty"),
          ).toHaveLength(1);
          const { client: capacityClient } = yield* setup;
          yield* capacityClient.wallet.create(request);
          yield* capacityClient.wallet.create(request);
          const outcomes = yield* Effect.all(
            Array.from({ length: 5 }, () =>
              capacityClient.wallet.create(request).pipe(Effect.result),
            ),
            { concurrency: "unbounded" },
          );
          expect(outcomes.filter(Result.isSuccess)).toHaveLength(1);
          expect(yield* capacityClient.wallet.list()).toHaveLength(3);
        }),
    );
  }
});
