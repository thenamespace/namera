import { expect, layer } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";

import { CredentialId, Email, SigningKeyId } from "@namera-ai/protocol";
import {
  OneClawAgentCredentialInsert as CredentialInsert,
  SigningKeyInsert,
} from "@namera-ai/protocol/model";
import { eq, sql } from "drizzle-orm";

import { Database, Repository, TestDatabase, TransactionService } from "../../../src/index.js";
import { credentials, signingKey } from "../../../src/schema/index.js";

const Persistence = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provideMerge(TestDatabase.layer),
);
const credentialId = Schema.decodeSync(CredentialId)("01900000-0000-7000-8000-000000000010");
const keyId = Schema.decodeSync(SigningKeyId)("01900000-0000-7000-8000-000000000020");
const providerData = {
  version: 1,
  type: "1claw",
  agentId: "test-agent",
  providerKeyId: "test-key",
  keyVersion: 1,
  chain: "ethereum",
} as const;

const fixture = Effect.fnUntraced(function* () {
  yield* (yield* TestDatabase).reset;
  const repository = yield* Repository;
  const user = yield* repository.auth.user.create({
    email: Schema.decodeSync(Email)("credentials@namera.test"),
    metadata: { version: 1 },
  });
  const organization = yield* repository.auth.organization.insert({
    createdById: user.id,
    metadata: { version: 1, name: "Credentials" },
  });
  const other = yield* repository.auth.organization.insert({
    createdById: user.id,
    metadata: { version: 1, name: "Other tenant" },
  });
  const credential = Schema.decodeUnknownSync(CredentialInsert)({
    id: credentialId,
    organizationId: organization.id,
    type: "1claw-agent",
    data: { version: 1, agentId: providerData.agentId },
    encryptedPayload: "synthetic-ciphertext-for-persistence-test",
  });
  const signer = Schema.decodeUnknownSync(SigningKeyInsert)({
    id: keyId,
    organizationId: organization.id,
    credentialId,
    purpose: "wallet-root",
    custody: "namera-managed",
    algorithm: "secp256k1",
    publicKeyHex: "0x04aabbcc",
    status: "active",
    data: providerData,
  });
  return { repository, organization, other, credential, signer };
});

layer(Persistence)("provider credential persistence", (it) => {
  it.effect("stores ciphertext, scopes reads and preserves credential relations", () =>
    Effect.gen(function* () {
      const { repository, organization, other, credential, signer } = yield* fixture();
      const inserted = yield* repository.core.credentials.insert(credential);
      yield* repository.core.signingKey.insert(signer);
      expect(inserted).toMatchObject(credential);
      expect(yield* repository.core.credentials.findById(credentialId, organization.id)).toEqual(
        inserted,
      );
      expect(yield* repository.core.credentials.findById(credentialId, other.id)).toBeUndefined();
      expect(
        (yield* repository.core.signingKey.findById(keyId, organization.id))?.credentialId,
      ).toBe(credentialId);
      const db = yield* Database;
      const related = yield* db.query.signingKey.findFirst({
        where: { id: { eq: keyId } },
        with: { credential: true },
      });
      expect(related?.credential?.id).toBe(credentialId);
    }),
  );

  it.effect("enforces missing and cross-tenant credential references and restricted deletion", () =>
    Effect.gen(function* () {
      const { repository, other, credential, signer } = yield* fixture();
      expect(yield* repository.core.signingKey.insert(signer).pipe(Effect.flip)).toMatchObject({
        _tag: "DatabaseError",
      });
      yield* repository.core.credentials.insert(credential);
      expect(
        yield* repository.core.signingKey
          .insert({ ...signer, organizationId: other.id })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "DatabaseError" });
      yield* repository.core.signingKey.insert(signer);
      const db = yield* Database;
      expect(
        yield* db
          .delete(credentials)
          .where(eq(credentials.id, credentialId))
          .pipe(Effect.isFailure),
      ).toBe(true);
      expect(
        yield* repository.core.credentials.findById(credentialId, credential.organizationId),
      ).toBeDefined();
    }),
  );

  it.effect(
    "rejects duplicate agents and provider key versions without exposing ciphertext in errors",
    () =>
      Effect.gen(function* () {
        const { repository, other, credential, signer } = yield* fixture();
        yield* repository.core.credentials.insert(credential);
        const duplicate = {
          ...credential,
          id: Schema.decodeSync(CredentialId)("01900000-0000-7000-8000-000000000011"),
        };
        const error = yield* repository.core.credentials.insert(duplicate).pipe(Effect.flip);
        expect(error).toMatchObject({ _tag: "DatabaseError" });
        expect(JSON.stringify(error)).not.toContain(credential.encryptedPayload);
        yield* repository.core.credentials.insert({ ...duplicate, organizationId: other.id });
        yield* repository.core.signingKey.insert(signer);
        const duplicateSigner = {
          ...signer,
          id: Schema.decodeSync(SigningKeyId)("01900000-0000-7000-8000-000000000021"),
          publicKeyHex: "0x04ddeeff" as const,
        };
        expect(
          yield* repository.core.signingKey.insert(duplicateSigner).pipe(Effect.flip),
        ).toMatchObject({ _tag: "DatabaseError" });
        const nextVersion = Schema.decodeUnknownSync(SigningKeyInsert)({
          ...duplicateSigner,
          data: { ...providerData, keyVersion: 2 },
        });
        expect((yield* repository.core.signingKey.insert(nextVersion)).id).toBe(nextVersion.id);
      }),
  );

  it.effect("commits related inserts together and rolls both back on failure", () =>
    Effect.gen(function* () {
      const { repository, organization, credential, signer } = yield* fixture();
      const transaction = yield* TransactionService;
      const inserts = Effect.gen(function* () {
        yield* repository.core.credentials.insert(credential);
        yield* repository.core.signingKey.insert(signer);
        expect(
          yield* repository.core.credentials.findById(credentialId, organization.id),
        ).toBeDefined();
      });
      expect(
        yield* transaction
          .run(inserts.pipe(Effect.andThen(Effect.fail("rollback"))))
          .pipe(Effect.flip),
      ).toBe("rollback");
      expect(
        yield* repository.core.credentials.findById(credentialId, organization.id),
      ).toBeUndefined();
      expect(yield* repository.core.signingKey.findById(keyId, organization.id)).toBeUndefined();
      yield* transaction.run(inserts);
      expect(yield* repository.core.signingKey.findById(keyId, organization.id)).toBeDefined();
    }),
  );

  it.effect("rejects malformed credential metadata even when bypassing protocol decoding", () =>
    Effect.gen(function* () {
      const { repository, credential } = yield* fixture();
      yield* repository.core.credentials.insert(credential);
      const db = yield* Database;
      for (const data of [
        {},
        null,
        [],
        { version: "1", agentId: "agent" },
        { version: 2, agentId: "agent" },
        { version: 1, agentId: "" },
        { version: 1, agentId: null },
        { version: 1, agentId: 123 },
      ]) {
        expect(
          yield* db
            .update(credentials)
            .set({ data: sql`${JSON.stringify(data)}::jsonb` })
            .where(eq(credentials.id, credentialId))
            .pipe(Effect.isFailure),
        ).toBe(true);
      }
      expect(
        yield* db
          .update(credentials)
          .set({ type: sql`'unknown'` })
          .where(eq(credentials.id, credentialId))
          .pipe(Effect.isFailure),
      ).toBe(true);
      expect(
        yield* db
          .update(credentials)
          .set({ encryptedPayload: "" })
          .where(eq(credentials.id, credentialId))
          .pipe(Effect.isFailure),
      ).toBe(true);
    }),
  );

  it.effect("enforces 1Claw metadata, algorithm and credential invariants in SQL", () =>
    Effect.gen(function* () {
      const { repository, credential, signer } = yield* fixture();
      yield* repository.core.credentials.insert(credential);
      yield* repository.core.signingKey.insert(signer);
      const db = yield* Database;
      for (const data of [
        { ...providerData, version: 2 },
        { ...providerData, version: null },
        { ...providerData, agentId: "" },
        { ...providerData, agentId: null },
        { ...providerData, providerKeyId: "" },
        { ...providerData, providerKeyId: null },
        { ...providerData, keyVersion: null },
        { ...providerData, keyVersion: "1" },
        { ...providerData, keyVersion: 0 },
        { ...providerData, keyVersion: 1.5 },
        { ...providerData, chain: "solana" },
        { ...providerData, chain: "midnight" },
        { ...providerData, chain: null },
      ]) {
        expect(
          yield* db
            .update(signingKey)
            .set({ data: sql`${JSON.stringify(data)}::jsonb` })
            .where(eq(signingKey.id, keyId))
            .pipe(Effect.isFailure),
        ).toBe(true);
      }
      for (const invalid of [
        { credentialId: null },
        { custody: "local" as const },
        { algorithm: "p256" as const },
      ]) {
        expect(
          yield* db
            .update(signingKey)
            .set(invalid)
            .where(eq(signingKey.id, keyId))
            .pipe(Effect.isFailure),
        ).toBe(true);
      }
      for (const [chain, algorithm] of [
        ["ethereum", "secp256k1"],
        ["bitcoin", "secp256k1"],
        ["tron", "secp256k1"],
        ["solana", "ed25519"],
        ["xrp", "ed25519"],
        ["cardano", "ed25519"],
      ] as const) {
        yield* db
          .update(signingKey)
          .set({ algorithm, data: { ...providerData, chain } })
          .where(eq(signingKey.id, keyId));
        expect(
          (yield* repository.core.signingKey.findById(keyId, signer.organizationId))?.algorithm,
        ).toBe(algorithm);
      }
    }),
  );

  it.effect("keeps existing provider and local records readable with null references", () =>
    Effect.gen(function* () {
      const { repository, credential, signer } = yield* fixture();
      yield* repository.core.credentials.insert(credential);
      const db = yield* Database;
      const variants = [
        { custody: "local", algorithm: "secp256k1", data: { version: 1, type: "local-key" } },
        {
          custody: "local",
          algorithm: "p256",
          data: {
            version: 1,
            type: "passkey",
            credentialId: "webauthn",
            rpId: "example.test",
            transports: [],
            signCount: 0,
          },
        },
        {
          custody: "namera-managed",
          algorithm: "p256",
          data: {
            version: 1,
            type: "gcp-kms",
            protectionLevel: "hsm",
            providerAlgorithm: "EC_SIGN_P256_SHA256",
            keyVersionName: "test-version",
          },
        },
        {
          custody: "namera-managed",
          algorithm: "p256",
          data: {
            version: 1,
            type: "local-provider",
            protectionLevel: "software",
            fileName: "test.json",
          },
        },
      ];
      for (const [index, variant] of variants.entries()) {
        const input = Schema.decodeUnknownSync(SigningKeyInsert)({
          ...signer,
          ...variant,
          credentialId: null,
          id: `01900000-0000-7000-8000-00000000003${index}`,
          publicKeyHex: `0x0${index}`,
        });
        const inserted = yield* repository.core.signingKey.insert(input);
        expect(inserted.credentialId).toBeNull();
        expect(
          yield* db
            .update(signingKey)
            .set({ credentialId })
            .where(eq(signingKey.id, inserted.id))
            .pipe(Effect.isFailure),
        ).toBe(true);
      }
    }),
  );
});
