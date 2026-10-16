import { readFileSync } from "node:fs";

import { expect, layer } from "@effect/vitest";
import { Effect, Exit, Ref } from "effect";
import { TestClock } from "effect/testing";

import { Application } from "@namera-ai/application";
import { Database, credentials } from "@namera-ai/database";
import { TestEvmExecution } from "@namera-ai/evm";

import { signIn, testEmail } from "../../fixtures/index.js";
import { localSessionRequest } from "../../fixtures/local-session.js";
import {
  prepareCustodyOperation,
  sessionCustodyLayer,
  setupSessionCustody,
} from "../../fixtures/session-custody.js";

const setup = Effect.gen(function* () {
  const fixture = yield* setupSessionCustody("passkey", "1claw");
  const { session, organizationId, repository } = fixture;
  const scope = { signingKeyId: session.signingKeyId, organizationId };
  const key = yield* repository.core.signingKey.findById(session.signingKeyId, organizationId);
  if (!key?.providerConnectionId) return yield* Effect.die("Missing provider connection");
  const connection = yield* repository.core.providerConnections.findByOrganization(
    organizationId,
    "test-app",
  );
  if (!connection?.customerCredentialId) return yield* Effect.die("Missing customer authority");
  return {
    ...fixture,
    key,
    connection,
    scope,
    jobs: repository.jobs.signingKeyDeactivation,
    app: yield* Application,
  };
});

layer(sessionCustodyLayer)("1Claw session deactivation", (it) => {
  it.effect(
    "backfills previously revoked managed signers without changing active sessions or owners",
    () =>
      Effect.gen(function* () {
        const { client, session, wallet, repository, organizationId, jobs, scope, control } =
          yield* setup;
        const active = yield* client.sessionKey.create({
          payload: {
            ...(yield* localSessionRequest(wallet.id)),
            signer: { custody: "namera-managed", provider: "1claw", algorithm: "secp256k1" },
          },
        });
        yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
        const db = yield* Database;
        yield* db.execute(
          `DELETE FROM jobs.signing_key_deactivation WHERE signing_key_id = '${session.signingKeyId}'`,
        );
        yield* db.execute(
          `UPDATE core.signing_key SET status = 'active' WHERE id = '${session.signingKeyId}'`,
        );
        yield* db.execute(
          `DELETE FROM audit.organization_events WHERE event = 'signing_key.deactivation_requested' AND resource_id = '${session.signingKeyId}'`,
        );
        const migration = readFileSync(
          new URL(
            "../../../../../packages/database/migrations/20261016115346_oneclaw-signing-key-deactivation/migration.sql",
            import.meta.url,
          ),
          "utf8",
        );
        const backfill = migration.split("--> statement-breakpoint").at(-1);
        if (!backfill) return yield* Effect.die("Missing migration backfill");
        yield* db.execute(backfill);
        yield* db.execute(backfill);
        expect(yield* jobs.findForSigner(scope)).toMatchObject({ status: "pending", attempts: 0 });
        expect(
          (yield* repository.core.signingKey.findById(session.signingKeyId, organizationId))
            ?.status,
        ).toBe("disabled");
        expect(
          (yield* repository.core.signingKey.findById(active.signingKeyId, organizationId))?.status,
        ).toBe("active");
        expect(
          (yield* repository.core.wallet.findById(wallet.id, organizationId))?.signingKey.status,
        ).toBe("active");
        expect(
          yield* jobs.findForSigner({ signingKeyId: active.signingKeyId, organizationId }),
        ).toBeUndefined();
        expect(
          (yield* repository.audit.organization.findForOrganization(organizationId)).filter(
            ({ event }) => event === "signing_key.deactivation_requested",
          ),
        ).toHaveLength(1);
        expect(yield* Ref.get(control.calls)).not.toContain("signingKeys.deactivate");
      }),
  );
  it.effect("rolls back local revocation if durable cleanup cannot be queued", () =>
    Effect.gen(function* () {
      const { client, session, repository, organizationId, jobs, scope } = yield* setup;
      const db = yield* Database;
      yield* db.execute(
        "ALTER TABLE jobs.signing_key_deactivation ADD CONSTRAINT test_reject_deactivation CHECK (false) NOT VALID",
      );
      yield* Effect.gen(function* () {
        expect(
          Exit.isFailure(
            yield* client.sessionKey
              .revoke({ params: { sessionKeyId: session.id } })
              .pipe(Effect.exit),
          ),
        ).toBe(true);
        expect(
          (yield* repository.core.sessionKey.findById(session.id, organizationId))?.status,
        ).toBe("pending");
        expect(
          (yield* repository.core.signingKey.findById(session.signingKeyId, organizationId))
            ?.status,
        ).toBe("active");
        expect(yield* jobs.findForSigner(scope)).toBeUndefined();
        expect(
          (yield* repository.audit.organization.findForOrganization(organizationId)).some(
            ({ event }) =>
              event === "signing_key.deactivation_requested" ||
              event === "session_key.revocation_requested",
          ),
        ).toBe(false);
      }).pipe(
        Effect.ensuring(
          db
            .execute(
              "ALTER TABLE jobs.signing_key_deactivation DROP CONSTRAINT test_reject_deactivation",
            )
            .pipe(Effect.orDie),
        ),
      );
    }),
  );
  it.effect(
    "disables locally and atomically queues one job, then audits remote completion once",
    () =>
      Effect.gen(function* () {
        const { client, session, organizationId, repository, jobs, scope, control, app } =
          yield* setup;
        expect(
          (yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } })).status,
        ).toBe("revoked");
        expect(
          yield* repository.core.signingKey.findById(session.signingKeyId, organizationId),
        ).toMatchObject({ status: "disabled" });
        expect(yield* jobs.findForSigner(scope)).toMatchObject({ status: "pending", attempts: 0 });
        expect(yield* Ref.get(control.calls)).not.toContain("signingKeys.deactivate");
        yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
        expect(yield* app.sessionKey.reconcileDeactivations()).toBe(1);
        expect(yield* jobs.findForSigner(scope)).toMatchObject({
          status: "completed",
          attempts: 1,
          leaseToken: null,
        });
        expect(yield* app.sessionKey.reconcileDeactivations()).toBe(0);
        yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
        expect((yield* jobs.findForSigner(scope))?.status).toBe("completed");
        const events = yield* repository.audit.organization.findForOrganization(organizationId);
        expect(
          events.filter(({ event }) => event === "signing_key.deactivation_requested"),
        ).toHaveLength(1);
        expect(events.filter(({ event }) => event === "signing_key.deactivated")).toHaveLength(1);
        expect(
          (yield* Ref.get(control.calls)).filter((call) => call === "signingKeys.deactivate"),
        ).toHaveLength(1);
      }),
  );

  it.effect("retains revocation and retries a provider timeout only when due", () =>
    Effect.gen(function* () {
      const { client, session, control, app, jobs, scope } = yield* setup;
      yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
      yield* Ref.set(control.failNext, "signingKeys.deactivate");
      expect(yield* app.sessionKey.reconcileDeactivations()).toBe(1);
      expect(yield* jobs.findForSigner(scope)).toMatchObject({
        status: "pending",
        attempts: 1,
        lastErrorCode: "TIMEOUT",
        leaseToken: null,
      });
      expect((yield* client.sessionKey.get({ params: { sessionKeyId: session.id } })).status).toBe(
        "revoked",
      );
      expect(yield* app.sessionKey.reconcileDeactivations()).toBe(0);
      yield* TestClock.adjust("30 seconds");
      expect(yield* app.sessionKey.reconcileDeactivations()).toBe(1);
      expect(yield* jobs.findForSigner(scope)).toMatchObject({ status: "completed", attempts: 2 });
    }),
  );

  it.effect("stops automatic retries after twelve failures and preserves a sanitized audit", () =>
    Effect.gen(function* () {
      const { client, session, control, app, jobs, scope, repository, organizationId } =
        yield* setup;
      yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
      for (let attempt = 0; attempt < 12; attempt++) {
        yield* Ref.set(control.failNext, "signingKeys.deactivate");
        expect(yield* app.sessionKey.reconcileDeactivations()).toBe(1);
        yield* TestClock.adjust("1 hour");
      }
      expect(yield* jobs.findForSigner(scope)).toMatchObject({
        status: "needs-attention",
        attempts: 12,
        lastErrorCode: "TIMEOUT",
      });
      expect(yield* app.sessionKey.reconcileDeactivations()).toBe(0);
      expect(
        (yield* repository.audit.organization.findForOrganization(organizationId)).filter(
          ({ event }) => event === "signing_key.deactivation_failed",
        ),
      ).toHaveLength(1);
    }),
  );

  it.effect("renews expired customer authority without bootstrapping or provisioning", () =>
    Effect.gen(function* () {
      const { client, session, connection, repository, organizationId, app, control, jobs, scope } =
        yield* setup;
      if (!connection.customerCredentialId) return yield* Effect.die("Missing customer credential");
      const before = yield* repository.core.credentials.findById(
        connection.customerCredentialId,
        organizationId,
      );
      yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
      yield* TestClock.adjust("25 hours");
      yield* app.sessionKey.reconcileDeactivations();
      expect((yield* jobs.findForSigner(scope))?.status).toBe("completed");
      const after = yield* repository.core.credentials.findById(
        connection.customerCredentialId,
        organizationId,
      );
      expect(after?.encryptedPayload).not.toBe(before?.encryptedPayload);
      const calls = yield* Ref.get(control.calls);
      expect(calls).toContain("connections.reissueClaim");
      expect(calls).toContain("customers.redeemClaim");
      expect(calls).not.toContain("connections.bootstrapEmpty");
      expect(calls).not.toContain("connections.upsert");
      expect(calls).not.toContain("agents.create");
      expect(JSON.stringify(yield* jobs.findForSigner(scope))).not.toMatch(
        /test-customer-token|test-agent-key|encryptedPayload/,
      );
    }),
  );

  it.effect("fails closed for a disabled connection without recreating customer setup", () =>
    Effect.gen(function* () {
      const { client, session, connection, repository, organizationId, app, control, jobs, scope } =
        yield* setup;
      yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
      yield* repository.core.providerConnections.disable({ id: connection.id, organizationId });
      yield* app.sessionKey.reconcileDeactivations();
      expect(yield* jobs.findForSigner(scope)).toMatchObject({
        status: "needs-attention",
        lastErrorCode: "CONNECTION_REVOKED",
      });
      expect(yield* Ref.get(control.calls)).toEqual([]);
      expect(
        (yield* repository.audit.organization.findForOrganization(organizationId)).filter(
          ({ event }) => event === "signing_key.deactivation_failed",
        ),
      ).toHaveLength(1);
    }),
  );

  it.effect("retains the job if recording the completion audit fails", () =>
    Effect.gen(function* () {
      const { client, session, jobs, scope, app, repository, organizationId } = yield* setup;
      yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
      const db = yield* Database;
      yield* db.execute(
        "ALTER TABLE audit.organization_events ADD CONSTRAINT test_reject_deactivation_audit CHECK (event <> 'signing_key.deactivated') NOT VALID",
      );
      yield* Effect.gen(function* () {
        expect(
          Exit.isFailure(yield* app.sessionKey.reconcileDeactivations().pipe(Effect.exit)),
        ).toBe(true);
        expect(yield* jobs.findForSigner(scope)).toMatchObject({
          status: "pending",
          attempts: 1,
          completedAt: null,
        });
        expect(
          (yield* repository.audit.organization.findForOrganization(organizationId)).some(
            ({ event }) => event === "signing_key.deactivated",
          ),
        ).toBe(false);
      }).pipe(
        Effect.ensuring(
          db
            .execute(
              "ALTER TABLE audit.organization_events DROP CONSTRAINT test_reject_deactivation_audit",
            )
            .pipe(Effect.orDie),
        ),
      );
      yield* TestClock.adjust("4 minutes");
      yield* app.sessionKey.reconcileDeactivations();
      expect(yield* jobs.findForSigner(scope)).toMatchObject({ status: "completed", attempts: 2 });
    }),
  );

  it.effect("classifies corrupt encrypted authority without sending it to the provider", () =>
    Effect.gen(function* () {
      const { client, session, connection, app, control, jobs, scope } = yield* setup;
      yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
      const db = yield* Database;
      yield* db.execute(
        `UPDATE core.credentials SET encrypted_payload = 'invalid-ciphertext' WHERE id = '${connection.customerCredentialId}'`,
      );
      yield* app.sessionKey.reconcileDeactivations();
      expect(yield* jobs.findForSigner(scope)).toMatchObject({
        status: "needs-attention",
        lastErrorCode: "DECRYPT_FAILED",
      });
      expect(yield* Ref.get(control.calls)).toEqual([]);
    }),
  );

  it.effect("rejects a customer token copied from another organization before remote calls", () =>
    Effect.gen(function* () {
      const first = yield* setup;
      yield* first.client.sessionKey.revoke({ params: { sessionKeyId: first.session.id } });
      yield* signIn(first.client, testEmail(`${crypto.randomUUID()}@example.com`));
      yield* first.client.wallet.create({
        payload: {
          namespace: "eip155",
          owner: { type: "namera-managed", provider: "1claw" },
          metadata: { version: 1, name: "Other organization" },
        },
      });
      const db = yield* Database;
      const rows = yield* db.select().from(credentials);
      const foreign = rows.find(
        (credential) =>
          credential.organizationId !== first.organizationId &&
          credential.type === "1claw-customer",
      );
      if (!foreign || !first.connection.customerCredentialId)
        return yield* Effect.die("Missing test customer credentials");
      yield* db.execute(
        `UPDATE core.credentials SET encrypted_payload = (SELECT encrypted_payload FROM core.credentials WHERE id = '${foreign.id}') WHERE id = '${first.connection.customerCredentialId}'`,
      );
      yield* Ref.set(first.control.calls, []);
      yield* first.app.sessionKey.reconcileDeactivations();
      expect(yield* Ref.get(first.control.calls)).toEqual([]);
      expect(yield* first.jobs.findForSigner(first.scope)).toMatchObject({
        status: "needs-attention",
        lastErrorCode: "IDENTITY_MISMATCH",
      });
    }),
  );

  it.effect.each(["passkey", "1claw"] as const)(
    "deactivates the session signer while preserving %s owner approval and onchain removal",
    (owner) =>
      Effect.gen(function* () {
        const fixture = yield* setupSessionCustody(owner, "1claw");
        const { client, session, repository, organizationId, wallet } = fixture;
        const app = yield* Application;
        const receipts = yield* TestEvmExecution;
        yield* receipts.setReceiptMode("immediate");
        for (const installation of session.installations) {
          const operation = yield* prepareCustodyOperation(client, owner, {
            installationId: installation.id,
            kind: "install",
            sponsor: false,
            idempotencyKey: crypto.randomUUID(),
          });
          yield* operation.approve;
          yield* TestClock.adjust("2 seconds");
          yield* app.sessionKey.reconcileOperations();
        }
        const apiKey = yield* client.apiKey.create({
          payload: {
            metadata: { version: 1, name: "Session access" },
            durationDays: 1,
            sessionKeyIds: [session.id],
          },
        });
        expect(
          (yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } })).status,
        ).toBe("revoking");
        expect(
          yield* repository.core.sessionKeyGrant.findActiveForActor(
            organizationId,
            apiKey.apiKey.actorId,
          ),
        ).toEqual([]);
        yield* app.sessionKey.reconcileDeactivations();
        expect(
          (yield* repository.jobs.signingKeyDeactivation.findForSigner({
            signingKeyId: session.signingKeyId,
            organizationId,
          }))?.status,
        ).toBe("completed");
        const parent = yield* repository.core.wallet.findById(wallet.id, organizationId);
        expect(parent?.signingKey.status).toBe("active");
        for (const installation of session.installations) {
          const operation = yield* prepareCustodyOperation(client, owner, {
            installationId: installation.id,
            kind: "uninstall",
            sponsor: false,
            idempotencyKey: crypto.randomUUID(),
          });
          yield* operation.approve;
          yield* TestClock.adjust("2 seconds");
          yield* app.sessionKey.reconcileOperations();
        }
        expect(
          (yield* client.sessionKey.get({ params: { sessionKeyId: session.id } })).status,
        ).toBe("revoked");
      }),
  );

  it.effect("keeps local session signers out of provider cleanup", () =>
    Effect.gen(function* () {
      const { client, session, repository, organizationId, control } = yield* setupSessionCustody(
        "passkey",
        "local",
      );
      yield* client.sessionKey.revoke({ params: { sessionKeyId: session.id } });
      expect(
        yield* repository.jobs.signingKeyDeactivation.findForSigner({
          signingKeyId: session.signingKeyId,
          organizationId,
        }),
      ).toBeUndefined();
      expect(
        (yield* repository.core.signingKey.findById(session.signingKeyId, organizationId))?.status,
      ).toBe("active");
      expect(yield* Ref.get(control.calls)).toEqual([]);
    }),
  );
});
