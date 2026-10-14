import { expect, layer } from "@effect/vitest";
import { Effect, Ref, Result } from "effect";
import { TestClock } from "effect/testing";

import { Database, Repository } from "@namera-ai/database";
import { CredentialId, SignerProvisioningId, SigningKeyId } from "@namera-ai/protocol";
import { OneClawTestControl, oneClawAccountTestLayer } from "@namera-ai/wallet-provider-oneclaw";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
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
const setup = Effect.gen(function* () {
  yield* resetTestState();
  yield* TestClock.setTime(Date.now());
  const control = yield* OneClawTestControl;
  yield* Ref.set(control.calls, []);
  yield* Ref.set(control.failNext, undefined);
  const client = yield* makeTestApiClient;
  const owner = yield* signIn(client, testEmail(`${crypto.randomUUID()}@example.com`));
  const request = {
    payload: {
      namespace: "eip155" as const,
      owner: { type: "namera-managed" as const, provider: "1claw" as const },
      metadata: { version: 1 as const, name: "Durable attempt" },
      idempotencyKey: crypto.randomUUID(),
    },
  };
  return { client, owner, control, request, repository: yield* Repository, db: yield* Database };
});

layer(Live)("durable signer provisioning", (it) => {
  it.effect("replays success and rejects changed input without allocating another agent", () =>
    Effect.gen(function* () {
      const { client, control, request, repository, owner } = yield* setup;
      const first = yield* client.wallet.create(request);
      const calls = yield* Ref.get(control.calls);
      expect((yield* client.wallet.create(request)).id).toBe(first.id);
      expect(
        yield* client.wallet
          .create({ payload: { ...request.payload, metadata: { version: 1, name: "Changed" } } })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "PROVIDER_RECOVERY_REQUIRED" });
      expect(yield* Ref.get(control.calls)).toEqual(calls);
      const events = yield* repository.audit.organization.findForOrganization(
        owner.actor.organization.id,
      );
      expect(events.filter(({ event }) => event === "wallet.created")).toHaveLength(1);
      const other = yield* client.wallet.create({
        payload: { ...request.payload, idempotencyKey: crypto.randomUUID() },
      });
      expect(other.id).not.toBe(first.id);
    }),
  );

  it.effect("isolates identical request keys between organizations", () =>
    Effect.gen(function* () {
      const { client, request, db } = yield* setup;
      const first = yield* client.wallet.create(request);
      yield* signIn(client, testEmail(`${crypto.randomUUID()}@example.com`));
      const second = yield* client.wallet.create(request);
      expect(second.id).not.toBe(first.id);
      expect(second.organizationId).not.toBe(first.organizationId);
      expect(yield* db.query.signerProvisioning.findMany()).toHaveLength(2);
    }),
  );

  it.effect("leaves an ambiguous remote creation quarantined across repeated requests", () =>
    Effect.gen(function* () {
      const { client, request, control, db } = yield* setup;
      yield* Ref.set(control.failNext, "agents.create");
      expect(yield* client.wallet.create(request).pipe(Effect.flip)).toMatchObject({
        code: "PROVIDER_RECOVERY_REQUIRED",
      });
      const calls = yield* Ref.get(control.calls);
      for (let retry = 0; retry < 3; retry++)
        expect(yield* client.wallet.create(request).pipe(Effect.flip)).toMatchObject({
          code: "PROVIDER_RECOVERY_REQUIRED",
        });
      expect(yield* Ref.get(control.calls)).toEqual(calls);
      const [attempt] = yield* db.query.signerProvisioning.findMany();
      expect(attempt).toMatchObject({
        status: "recovery_required",
        stage: "agent_create_started",
        signer: null,
        resourceId: null,
      });
      expect(yield* client.wallet.list()).toEqual([]);
    }),
  );

  if (process.env.NAMERA_TEST_POSTGRES_PORT) {
    it.effect("concurrent retries create only one signer and account", () =>
      Effect.gen(function* () {
        const { client, request, control, db } = yield* setup;
        const results = yield* Effect.all(
          Array.from({ length: 6 }, () => client.wallet.create(request).pipe(Effect.result)),
          { concurrency: "unbounded" },
        );
        expect(results.some(Result.isSuccess)).toBe(true);
        const completed = yield* client.wallet.create(request);
        for (const result of results)
          if (Result.isSuccess(result)) expect(result.success.id).toBe(completed.id);
        expect(
          (yield* Ref.get(control.calls)).filter((call) => call === "agents.create"),
        ).toHaveLength(1);
        expect(yield* client.wallet.list()).toHaveLength(1);
        expect(yield* db.query.signerProvisioning.findMany()).toHaveLength(1);
      }),
    );

    it.effect("expired remote work cannot be reclaimed or completed by a stale worker", () =>
      Effect.gen(function* () {
        const { owner, repository, db } = yield* setup;
        const attempts = repository.core.signerProvisioning;
        const record = yield* attempts.reserve({
          id: SignerProvisioningId.make("01900000-0000-7000-8000-000000000001"),
          organizationId: owner.actor.organization.id,
          actorId: owner.actor.actorId,
          provider: "future-provider",
          purpose: "wallet-root",
          idempotencyKey: "crash-case",
          requestHash: "synthetic-hash",
          signingKeyId: SigningKeyId.make("01900000-0000-7000-8000-000000000002"),
          credentialId: CredentialId.make("01900000-0000-7000-8000-000000000003"),
        });
        const oldLease = {
          id: record.id,
          organizationId: record.organizationId,
          leaseToken: "old-owner",
        };
        expect(yield* attempts.claim(oldLease)).toBeDefined();
        expect(yield* attempts.stage(oldLease, "remote_create_started")).toBe(true);
        yield* db.execute(
          "UPDATE core.signer_provisioning SET lease_expires_at = clock_timestamp() - interval '1 second'",
        );
        const replacement = { ...oldLease, leaseToken: "new-owner" };
        expect(yield* attempts.claim(replacement)).toBeUndefined();
        expect(yield* attempts.renew(oldLease)).toBe(false);
        expect(yield* attempts.stage(oldLease, "late_result")).toBe(false);
        expect(yield* attempts.complete(oldLease, "synthetic-resource")).toBe(false);
        expect((yield* db.query.signerProvisioning.findMany())[0]?.status).toBe(
          "recovery_required",
        );
      }),
    );

    it.effect("a pending lease can be recovered without allowing stale-owner writes", () =>
      Effect.gen(function* () {
        const { owner, repository, db } = yield* setup;
        const attempts = repository.core.signerProvisioning;
        const record = yield* attempts.reserve({
          id: SignerProvisioningId.make("01900000-0000-7000-8000-000000000001"),
          organizationId: owner.actor.organization.id,
          actorId: owner.actor.actorId,
          provider: "future-provider",
          purpose: "session",
          idempotencyKey: "before-remote",
          requestHash: "synthetic-hash",
          signingKeyId: SigningKeyId.make("01900000-0000-7000-8000-000000000002"),
          credentialId: CredentialId.make("01900000-0000-7000-8000-000000000003"),
        });
        const oldLease = {
          id: record.id,
          organizationId: record.organizationId,
          leaseToken: "old-owner",
        };
        expect(yield* attempts.claim(oldLease)).toBeDefined();
        yield* db.execute(
          "UPDATE core.signer_provisioning SET lease_expires_at = clock_timestamp() - interval '1 second'",
        );
        const replacement = { ...oldLease, leaseToken: "new-owner" };
        expect(yield* attempts.claim(replacement)).toBeDefined();
        yield* attempts.release(oldLease);
        expect(yield* attempts.stage(oldLease, "remote_create_started")).toBe(false);
        expect(yield* attempts.stage(replacement, "remote_create_started")).toBe(true);
        yield* attempts.release(replacement);
      }),
    );
  }
});
