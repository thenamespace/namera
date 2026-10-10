import { expect, layer } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";

import { CredentialId, ProviderConnectionId, SigningKeyId } from "@namera-ai/protocol";
import { ProviderConnectionInsert } from "@namera-ai/protocol/model";
import { generateUniqueId } from "@namera-ai/utils";
import { eq } from "drizzle-orm";

import { Database, Repository, TestDatabase, TransactionService } from "../../../src/index.js";
import { sessionKey, signingKey } from "../../../src/schema/index.js";
import { installationFixture } from "../../fixtures/session-installation.js";

const Persistence = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provideMerge(TestDatabase.layer),
);

const fixture = Effect.fnUntraced(function* () {
  yield* (yield* TestDatabase).reset;
  const local = yield* installationFixture("session-signer");
  const repository = yield* Repository;
  const credentialId = CredentialId.make(generateUniqueId());
  const connectionId = ProviderConnectionId.make(generateUniqueId());
  yield* repository.core.providerConnections.reserve(
    Schema.decodeUnknownSync(ProviderConnectionInsert)({
      id: connectionId,
      organizationId: local.organization.id,
      provider: "1claw",
      providerAppId: "test-app",
      externalConnectionId: null,
      customerCredentialId: null,
      status: "pending",
      data: {
        version: 1,
        customerId: null,
        oidcSubject: "session-org",
        email: "session@namera.test",
        bootstrapCompletedAt: null,
        delegationEnabledAt: null,
      },
    }),
  );
  yield* repository.core.credentials.insert({
    id: credentialId,
    organizationId: local.organization.id,
    type: "1claw-agent",
    data: { version: 1, agentId: "session-agent" },
    encryptedPayload: "synthetic-ciphertext",
  });
  const signer = {
    id: SigningKeyId.make(generateUniqueId()),
    organizationId: local.organization.id,
    purpose: "session",
    custody: "namera-managed",
    algorithm: "secp256k1",
    status: "active",
    publicKeyHex: "0x04ccddee",
    credentialId,
    providerConnectionId: connectionId,
    data: {
      version: 1,
      type: "1claw",
      chain: "ethereum",
      agentId: "session-agent",
      providerKeyId: "session-provider-key",
      keyVersion: 1,
    },
  } as const;
  const session = {
    organizationId: local.organization.id,
    walletId: local.wallet.id,
    signingKeyId: signer.id,
    createdByActorId: local.actor.id,
    namespace: "eip155",
    metadata: { version: 1, name: "Managed" },
    policies: [],
    policyHash: "test",
  } as const;
  return { ...local, repository, signer, session };
});

layer(Persistence)("session signer invariants", (it) => {
  it.effect(
    "stores a managed session independently of its passkey owner and scopes signer reads",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.repository.core.signingKey.insert(f.signer);
        const created = yield* f.repository.core.sessionKey.insert(f.session);
        expect(created.status).toBe("pending");
        const other = yield* installationFixture("session-signer-other");
        expect(
          yield* f.repository.core.signingKey.findForSessions(other.organization.id, [f.signer.id]),
        ).toEqual([]);
        expect(
          yield* f.repository.core.signingKey.findForSessions(f.organization.id, [
            f.signer.id,
            f.wallet.signingKeyId,
          ]),
        ).toMatchObject([{ id: f.signer.id, purpose: "session" }]);
        expect(yield* f.repository.core.sessionKey.insert(f.session).pipe(Effect.isFailure)).toBe(
          true,
        );
        const db = yield* Database;
        expect(
          yield* db
            .update(signingKey)
            .set({ purpose: "wallet-root" })
            .where(eq(signingKey.id, f.signer.id))
            .pipe(Effect.isFailure),
        ).toBe(true);
      }),
  );

  it.effect("rejects root-key substitution even when bypassing repositories", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      expect(
        yield* f.repository.core.sessionKey
          .insert({ ...f.session, signingKeyId: f.wallet.signingKeyId })
          .pipe(Effect.isFailure),
      ).toBe(true);
      const db = yield* Database;
      expect(
        yield* db
          .insert(sessionKey)
          .values({
            ...f.session,
            signingKeyId: f.wallet.signingKeyId,
            signingKeyPurpose: "wallet-root" as "session",
            policies: [],
          })
          .pipe(Effect.isFailure),
      ).toBe(true);
    }),
  );

  it.effect(
    "rejects missing and cross-tenant provider bindings and rolls back with its transaction",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const db = yield* Database;
        expect(
          yield* db
            .insert(signingKey)
            .values({ ...f.signer, providerConnectionId: null })
            .pipe(Effect.isFailure),
        ).toBe(true);
        const other = yield* installationFixture("session-signer-foreign");
        expect(
          yield* f.repository.core.signingKey
            .insert({ ...f.signer, organizationId: other.organization.id })
            .pipe(Effect.isFailure),
        ).toBe(true);
        yield* f.repository.core.signingKey.insert(f.signer);
        expect(
          yield* f.repository.core.sessionKey
            .insert({
              ...f.session,
              organizationId: other.organization.id,
              walletId: other.wallet.id,
              createdByActorId: other.actor.id,
            })
            .pipe(Effect.isFailure),
        ).toBe(true);
        const transaction = yield* TransactionService;
        expect(
          yield* transaction
            .run(
              Effect.gen(function* () {
                yield* f.repository.core.sessionKey.insert(f.session);
                return yield* Effect.fail("rollback");
              }),
            )
            .pipe(Effect.isFailure),
        ).toBe(true);
        expect(
          yield* f.repository.core.sessionKey.findForOrganization(f.organization.id),
        ).toHaveLength(1);
      }),
  );
});
