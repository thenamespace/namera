import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Schema } from "effect";

import { CredentialId, Email, ProviderConnectionId, SigningKeyId } from "@namera-ai/protocol";
import {
  CredentialInsert,
  ProviderConnectionInsert,
  SigningKeyInsert,
} from "@namera-ai/protocol/model";
import { eq, sql } from "drizzle-orm";

import { Database, Repository, TestDatabase, TransactionService } from "../../../src/index.js";
import { credentials, providerConnections, signingKey } from "../../../src/schema/index.js";

const port = process.env.NAMERA_TEST_POSTGRES_PORT;
const Persistence = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provideMerge(port ? TestDatabase.postgresLayer(Number(port)) : TestDatabase.layer),
);
const id = Schema.decodeSync(ProviderConnectionId)("01900000-0000-7000-8000-000000000040");
const credentialId = Schema.decodeSync(CredentialId)("01900000-0000-7000-8000-000000000041");
const secondId = Schema.decodeSync(ProviderConnectionId)("01900000-0000-7000-8000-000000000042");
const agentCredentialId = Schema.decodeSync(CredentialId)("01900000-0000-7000-8000-000000000043");
const keyId = Schema.decodeSync(SigningKeyId)("01900000-0000-7000-8000-000000000044");

const fixture = Effect.fnUntraced(function* () {
  yield* (yield* TestDatabase).reset;
  const repository = yield* Repository;
  const user = yield* repository.auth.user.create({
    email: Schema.decodeSync(Email)("connections@namera.test"),
    metadata: { version: 1 },
  });
  const organization = yield* repository.auth.organization.insert({
    createdById: user.id,
    metadata: { version: 1, name: "Connections" },
  });
  const other = yield* repository.auth.organization.insert({
    createdById: user.id,
    metadata: { version: 1, name: "Other" },
  });
  const input = Schema.decodeUnknownSync(ProviderConnectionInsert)({
    id,
    organizationId: organization.id,
    provider: "1claw",
    providerAppId: "test-app",
    externalConnectionId: null,
    customerCredentialId: null,
    status: "pending",
    data: {
      version: 1,
      customerId: null,
      oidcSubject: "test-org",
      email: "org@namera.test",
      bootstrapCompletedAt: null,
      delegationEnabledAt: null,
    },
  });
  const customer = Schema.decodeUnknownSync(CredentialInsert)({
    id: credentialId,
    organizationId: organization.id,
    type: "1claw-customer",
    encryptedPayload: "synthetic-customer-ciphertext",
    expiresAt: new Date("2099-01-01T00:00:00Z"),
    data: {
      version: 1,
      providerConnectionId: id,
      providerAppId: "test-app",
      externalConnectionId: "test-connection",
      customerId: "test-customer",
    },
  });
  const connections = repository.core.providerConnections;
  const lease = { id, organizationId: organization.id, leaseToken: "test-lease" };
  yield* connections.reserve(input);
  return { repository, connections, organization, other, input, customer, lease };
});

const setup = Effect.fnUntraced(function* () {
  const f = yield* fixture();
  expect(yield* f.connections.acquireLease(f.lease)).toBe(true);
  yield* f.connections.reconcileIdentity({
    ...f.lease,
    externalConnectionId: "test-connection",
    customerId: "test-customer",
  });
  yield* f.connections.recordBootstrap(f.lease);
  yield* f.repository.core.credentials.insert(f.customer);
  yield* f.connections.attachCustomerCredential({ ...f.lease, credentialId });
  return f;
});

layer(Persistence)("provider connection persistence", (it) => {
  it.effect(
    "reserves one mapping per tenant/app and reconciles identity without substitution",
    () =>
      Effect.gen(function* () {
        const { connections, input, lease, other } = yield* fixture();
        expect(yield* connections.reserve({ ...input, id: secondId })).toBeUndefined();
        expect(yield* connections.findByOrganization(other.id, "test-app")).toBeUndefined();
        expect(
          yield* connections.findByOrganization(input.organizationId, "other-app"),
        ).toBeUndefined();
        expect(
          yield* connections.reserve({ ...input, id: secondId, organizationId: other.id }),
        ).toBeUndefined();
        expect(
          yield* connections.reserve({
            ...input,
            id: secondId,
            organizationId: other.id,
            data: { ...input.data, oidcSubject: "other" },
          }),
        ).toBeDefined();
        yield* connections.acquireLease(lease);
        const identity = {
          ...lease,
          externalConnectionId: "test-connection",
          customerId: "test-customer",
        };
        expect(yield* connections.reconcileIdentity(identity)).toBeDefined();
        expect(yield* connections.reconcileIdentity(identity)).toBeDefined();
        expect(
          yield* connections.reconcileIdentity({ ...identity, customerId: "different" }),
        ).toBeUndefined();
        const otherLease = { ...lease, id: secondId, organizationId: other.id };
        yield* connections.acquireLease(otherLease);
        expect(
          yield* connections
            .reconcileIdentity({ ...identity, ...otherLease })
            .pipe(Effect.isFailure),
        ).toBe(true);
      }),
  );

  it.effect("fences stale lease owners and prevents takeover before expiry", () =>
    Effect.gen(function* () {
      const { connections, lease, other } = yield* fixture();
      expect(yield* connections.acquireLease({ ...lease, organizationId: other.id })).toBe(false);
      expect(yield* connections.acquireLease(lease)).toBe(true);
      const next = { ...lease, leaseToken: "next-owner" };
      expect(yield* connections.acquireLease(next)).toBe(false);
      expect(yield* connections.releaseLease(next)).toBe(false);
      expect(yield* connections.renewLease(next)).toBe(false);
      expect(yield* connections.renewLease(lease)).toBe(true);
      const db = yield* Database;
      yield* db
        .update(providerConnections)
        .set({ leaseExpiresAt: sql`now() - interval '1 second'` })
        .where(eq(providerConnections.id, id));
      expect(yield* connections.recordBootstrap(lease)).toBeUndefined();
      expect(yield* connections.renewLease(lease)).toBe(false);
      expect(yield* connections.startBootstrap(lease)).toBe(false);
      expect(yield* connections.acquireLease(next)).toBe(true);
      expect(yield* connections.releaseLease(lease)).toBe(false);
      expect(
        yield* connections.reconcileIdentity({
          ...lease,
          externalConnectionId: "stale",
          customerId: "stale",
        }),
      ).toBeUndefined();
      expect(yield* connections.releaseLease(next)).toBe(true);
    }),
  );

  it.effect("records a bootstrap attempt once and fences it to the live tenant lease", () =>
    Effect.gen(function* () {
      const { connections, lease, other } = yield* fixture();
      yield* connections.acquireLease(lease);
      yield* connections.reconcileIdentity({
        ...lease,
        externalConnectionId: "test-connection",
        customerId: "test-customer",
      });
      expect(yield* connections.startBootstrap({ ...lease, organizationId: other.id })).toBe(false);
      expect(yield* connections.startBootstrap(lease)).toBe(true);
      expect(yield* connections.startBootstrap(lease)).toBe(false);
      const current = yield* connections.findByIdForUpdate(lease.id, lease.organizationId);
      expect(current?.data.bootstrapAttemptedAt).toBeDefined();
      expect(yield* connections.findByIdForUpdate(lease.id, other.id)).toBeUndefined();
    }),
  );

  it.effect("requires customer type, matching authority and completed setup before readiness", () =>
    Effect.gen(function* () {
      const { connections, repository, lease, customer, other } = yield* fixture();
      yield* connections.acquireLease(lease);
      expect(yield* connections.markReady(lease)).toBeUndefined();
      expect(yield* connections.recordBootstrap(lease)).toBeUndefined();
      yield* connections.reconcileIdentity({
        ...lease,
        externalConnectionId: "test-connection",
        customerId: "test-customer",
      });
      const db = yield* Database;
      const agent = Schema.decodeUnknownSync(CredentialInsert)({
        id: agentCredentialId,
        organizationId: lease.organizationId,
        type: "1claw-agent",
        data: { version: 1, agentId: "agent" },
        encryptedPayload: "synthetic-agent-ciphertext",
      });
      yield* repository.core.credentials.insert(agent);
      expect(
        yield* connections.attachCustomerCredential({ ...lease, credentialId: agentCredentialId }),
      ).toBeUndefined();
      expect(
        yield* db
          .update(providerConnections)
          .set({ customerCredentialId: agentCredentialId, organizationId: other.id })
          .where(eq(providerConnections.id, id))
          .pipe(Effect.isFailure),
      ).toBe(true);
      if (customer.type !== "1claw-customer") throw new Error("fixture variant");
      for (const mismatch of [
        { providerConnectionId: secondId },
        { providerAppId: "other-app" },
        { externalConnectionId: "other-connection" },
        { customerId: "other-customer" },
      ]) {
        yield* repository.core.credentials.insert({
          ...customer,
          data: { ...customer.data, ...mismatch },
        });
        expect(
          yield* connections.attachCustomerCredential({ ...lease, credentialId }),
        ).toBeUndefined();
        yield* db.delete(credentials).where(eq(credentials.id, credentialId));
      }
      yield* repository.core.credentials.insert(customer);
      expect(yield* connections.attachCustomerCredential({ ...lease, credentialId })).toBeDefined();
      expect(yield* connections.markReady(lease)).toBeUndefined();
      yield* connections.recordBootstrap(lease);
      expect(yield* connections.markReady(lease)).toMatchObject({ status: "ready" });
      const related = yield* db.query.providerConnections.findFirst({
        where: { id: { eq: id } },
        with: { customerCredential: true },
      });
      expect(related?.customerCredential?.id).toBe(credentialId);
      expect(
        yield* db
          .delete(credentials)
          .where(eq(credentials.id, credentialId))
          .pipe(Effect.isFailure),
      ).toBe(true);
    }),
  );

  it.effect("renews ciphertext only with the current lease and ciphertext version", () =>
    Effect.gen(function* () {
      const { connections, repository, lease, customer } = yield* setup();
      yield* connections.markReady(lease);
      const replacement = {
        id: credentialId,
        organizationId: lease.organizationId,
        leaseToken: lease.leaseToken,
        expectedEncryptedPayload: customer.encryptedPayload,
        encryptedPayload: "synthetic-renewed-ciphertext",
        expiresAt: DateTime.makeUnsafe("2099-02-01T00:00:00Z"),
      };
      expect(
        yield* repository.core.credentials.replaceCustomerToken({
          ...replacement,
          leaseToken: "wrong",
        }),
      ).toBeUndefined();
      expect(
        yield* repository.core.credentials.replaceCustomerToken({
          ...replacement,
          expiresAt: DateTime.makeUnsafe("2000-01-01T00:00:00Z"),
        }),
      ).toBeUndefined();
      expect(yield* repository.core.credentials.replaceCustomerToken(replacement)).toMatchObject({
        encryptedPayload: replacement.encryptedPayload,
      });
      expect(yield* repository.core.credentials.replaceCustomerToken(replacement)).toBeUndefined();
      const invalid = {
        ...replacement,
        expectedEncryptedPayload: replacement.encryptedPayload,
        encryptedPayload: "",
      };
      const error = yield* repository.core.credentials
        .replaceCustomerToken(invalid)
        .pipe(Effect.flip);
      expect(JSON.stringify(error)).not.toContain(replacement.encryptedPayload);
      yield* connections.disable(lease);
      expect(yield* connections.acquireLease({ ...lease, leaseToken: "next" })).toBe(false);
      expect(
        yield* repository.core.credentials.replaceCustomerToken({
          ...replacement,
          expectedEncryptedPayload: replacement.encryptedPayload,
        }),
      ).toBeUndefined();
    }),
  );

  it.effect("rolls back readiness and token replacement with the enclosing transaction", () =>
    Effect.gen(function* () {
      const { connections, repository, lease, customer } = yield* setup();
      const transaction = yield* TransactionService;
      const mutation = Effect.gen(function* () {
        yield* connections.markReady(lease);
        yield* repository.core.credentials.replaceCustomerToken({
          id: credentialId,
          organizationId: lease.organizationId,
          leaseToken: lease.leaseToken,
          expectedEncryptedPayload: customer.encryptedPayload,
          encryptedPayload: "rolled-back-ciphertext",
          expiresAt: DateTime.makeUnsafe("2099-02-01T00:00:00Z"),
        });
        return yield* Effect.fail("rollback");
      });
      expect(yield* transaction.run(mutation).pipe(Effect.flip)).toBe("rollback");
      expect(yield* connections.findByOrganization(lease.organizationId, "test-app")).toMatchObject(
        { status: "pending", data: { delegationEnabledAt: null } },
      );
      expect(
        yield* repository.core.credentials.findById(credentialId, lease.organizationId),
      ).toMatchObject({ encryptedPayload: customer.encryptedPayload });
    }),
  );

  it.effect("enforces SQL data, expiry and lease constraints without protocol validation", () =>
    Effect.gen(function* () {
      const { repository, customer } = yield* fixture();
      yield* repository.core.credentials.insert(customer);
      const db = yield* Database;
      for (const patch of [
        { expiresAt: null },
        { type: sql`'unknown'` },
        { data: sql`'{}'::jsonb` },
      ]) {
        expect(
          yield* db
            .update(credentials)
            .set(patch)
            .where(eq(credentials.id, credentialId))
            .pipe(Effect.isFailure),
        ).toBe(true);
      }
      for (const patch of [
        { leaseToken: "owner" },
        { leaseExpiresAt: new Date() },
        { status: "ready" as const },
        { data: sql`'{}'::jsonb` },
      ]) {
        expect(
          yield* db
            .update(providerConnections)
            .set(patch)
            .where(eq(providerConnections.id, id))
            .pipe(Effect.isFailure),
        ).toBe(true);
      }
      expect(
        yield* repository.core.credentials
          .insert({ ...customer, id: agentCredentialId })
          .pipe(Effect.isFailure),
      ).toBe(true);
    }),
  );

  it.effect("links signers within their tenant and keeps legacy null links readable", () =>
    Effect.gen(function* () {
      const { repository, lease, other } = yield* fixture();
      yield* repository.core.credentials.insert(
        Schema.decodeUnknownSync(CredentialInsert)({
          id: agentCredentialId,
          organizationId: lease.organizationId,
          type: "1claw-agent",
          data: { version: 1, agentId: "agent" },
          encryptedPayload: "synthetic-agent-ciphertext",
        }),
      );
      const signer = Schema.decodeUnknownSync(SigningKeyInsert)({
        id: keyId,
        organizationId: lease.organizationId,
        credentialId: agentCredentialId,
        purpose: "wallet-root",
        custody: "namera-managed",
        algorithm: "secp256k1",
        publicKeyHex: "0x04aabbcc",
        status: "active",
        data: {
          version: 1,
          type: "1claw",
          agentId: "agent",
          providerKeyId: "key",
          keyVersion: 1,
          chain: "ethereum",
        },
      });
      expect(yield* repository.core.signingKey.insert(signer)).toMatchObject({
        providerConnectionId: null,
      });
      const db = yield* Database;
      expect(
        yield* db
          .update(signingKey)
          .set({ providerConnectionId: secondId })
          .where(eq(signingKey.id, keyId))
          .pipe(Effect.isFailure),
      ).toBe(true);
      yield* db
        .update(signingKey)
        .set({ providerConnectionId: id })
        .where(eq(signingKey.id, keyId));
      expect(
        yield* db
          .update(providerConnections)
          .set({ organizationId: other.id })
          .where(eq(providerConnections.id, id))
          .pipe(Effect.isFailure),
      ).toBe(true);
      expect(
        yield* db
          .delete(providerConnections)
          .where(eq(providerConnections.id, id))
          .pipe(Effect.isFailure),
      ).toBe(true);
      expect(yield* repository.core.signingKey.findById(keyId, lease.organizationId)).toMatchObject(
        { providerConnectionId: id },
      );
    }),
  );

  it.effect("admits one setup owner and one renewal winner under contention", () =>
    Effect.gen(function* () {
      const { connections, input, lease, repository, customer } = yield* fixture();
      const db = yield* Database;
      yield* db.delete(providerConnections).where(eq(providerConnections.id, id));
      const reservations = yield* Effect.all(
        Array.from({ length: 4 }, () => connections.reserve(input)),
        { concurrency: "unbounded" },
      );
      expect(reservations.filter(Boolean)).toHaveLength(1);
      const leases = Array.from({ length: 8 }, (_, index) => ({
        ...lease,
        leaseToken: `owner-${index}`,
      }));
      const results = yield* Effect.all(
        leases.map((candidate) => connections.acquireLease(candidate)),
        { concurrency: "unbounded" },
      );
      expect(results.filter(Boolean)).toHaveLength(1);
      const winner = leases[results.indexOf(true)];
      if (winner === undefined) throw new Error("Expected a winning lease");
      yield* connections.reconcileIdentity({
        ...winner,
        externalConnectionId: "test-connection",
        customerId: "test-customer",
      });
      yield* repository.core.credentials.insert(customer);
      yield* connections.attachCustomerCredential({ ...winner, credentialId });
      const renewals = yield* Effect.all(
        Array.from({ length: 8 }, (_, index) =>
          repository.core.credentials.replaceCustomerToken({
            id: credentialId,
            organizationId: lease.organizationId,
            leaseToken: winner.leaseToken,
            expectedEncryptedPayload: customer.encryptedPayload,
            encryptedPayload: `renewed-${index}`,
            expiresAt: DateTime.makeUnsafe("2099-02-01T00:00:00Z"),
          }),
        ),
        { concurrency: "unbounded" },
      );
      expect(renewals.filter(Boolean)).toHaveLength(1);
    }),
  );
});
