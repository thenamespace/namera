import { expect, layer } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";

import { Email, OrganizationId, SigningKeyId } from "@namera-ai/protocol";

import { Repository, TestDatabase } from "../../src/index.js";

const PersistenceLayer = Repository.layer.pipe(Layer.provideMerge(TestDatabase.layer));

layer(PersistenceLayer)("signing key repository", (it) => {
  it.effect("persists, resolves, and terminally destroys a local passkey", () =>
    Effect.gen(function* () {
      const repository = yield* Repository;
      const testDatabase = yield* TestDatabase;
      yield* testDatabase.reset;

      const user = yield* repository.auth.user.create({
        email: Schema.decodeSync(Email)("signing-key@namera.test"),
        metadata: { version: 1, name: "Signing Key Owner" },
      });
      const organization = yield* repository.auth.organization.insert({
        createdById: user.id,
        metadata: { version: 1, name: "Signing Key Test" },
      });

      const inserted = yield* repository.core.signingKey.insert({
        id: Schema.decodeSync(SigningKeyId)("01900000-0000-7000-8000-000000000001"),
        organizationId: organization.id,
        purpose: "wallet-root",
        custody: "local",
        algorithm: "p256",
        publicKeyHex: "0x04aabbcc",
        status: "active",
        data: {
          version: 1,
          type: "passkey",
          credentialId: "credential-id",
          rpId: "dashboard.namera.test",
          transports: ["internal"],
          signCount: 0,
        },
      });

      const byId = yield* repository.core.signingKey.findById(inserted.id, organization.id);
      const byPublicKey = yield* repository.core.signingKey.findByPublicKey({
        organizationId: organization.id,
        algorithm: inserted.algorithm,
        publicKeyHex: inserted.publicKeyHex,
      });

      expect(byId?.id).toBe(inserted.id);
      expect(byPublicKey?.id).toBe(inserted.id);

      const destroyed = yield* repository.core.signingKey.setStatus(
        inserted.id,
        organization.id,
        "destroyed",
      );
      const restored = yield* repository.core.signingKey.setStatus(
        inserted.id,
        organization.id,
        "active",
      );
      const persisted = yield* repository.core.signingKey.findById(inserted.id, organization.id);

      expect(destroyed?.status).toBe("destroyed");
      expect(restored).toBeUndefined();
      expect(persisted?.status).toBe("destroyed");
    }),
  );

  it.effect("scopes lookups to the organization", () =>
    Effect.gen(function* () {
      const repository = yield* Repository;
      const testDatabase = yield* TestDatabase;
      yield* testDatabase.reset;

      const user = yield* repository.auth.user.create({
        email: Schema.decodeSync(Email)("signing-key-tenant@namera.test"),
        metadata: { version: 1 },
      });
      const organization = yield* repository.auth.organization.insert({
        createdById: user.id,
        metadata: { version: 1, name: "Signing Key Tenant" },
      });
      const inserted = yield* repository.core.signingKey.insert({
        id: Schema.decodeSync(SigningKeyId)("01900000-0000-7000-8000-000000000002"),
        organizationId: organization.id,
        purpose: "session",
        custody: "local",
        algorithm: "secp256k1",
        publicKeyHex: "0x04ddeeff",
        status: "active",
        data: { version: 1, type: "local-key" },
      });

      const missingOrganizationId = Schema.decodeSync(OrganizationId)(
        "01900000-0000-7000-8000-000000000099",
      );
      const result = yield* repository.core.signingKey.findById(inserted.id, missingOrganizationId);

      expect(result).toBeUndefined();
    }),
  );
});
