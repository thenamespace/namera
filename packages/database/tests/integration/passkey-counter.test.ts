import { expect, layer } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";

import { Email, OrganizationId, SigningKeyId } from "@namera-ai/protocol";

import { Repository, TestDatabase } from "../../src/index.js";

const Persistence = Repository.layer.pipe(Layer.provideMerge(TestDatabase.layer));

layer(Persistence)("passkey approval counters", (it) => {
  it.effect("binds an active credential and atomically rejects stale or decreasing counters", () =>
    Effect.gen(function* () {
      yield* (yield* TestDatabase).reset;
      const repository = yield* Repository;
      const user = yield* repository.auth.user.create({
        email: Schema.decodeSync(Email)("passkey-counter@namera.test"),
        metadata: { version: 1 },
      });
      const organization = yield* repository.auth.organization.insert({
        createdById: user.id,
        metadata: { version: 1, name: "Counter test" },
      });
      const key = yield* repository.core.signingKey.insert({
        id: Schema.decodeSync(SigningKeyId)("01900000-0000-7000-8000-000000000001"),
        organizationId: organization.id,
        purpose: "wallet-root",
        custody: "local",
        algorithm: "p256",
        status: "active",
        publicKeyHex: "0x04aabbcc",
        data: {
          version: 1,
          type: "passkey",
          credentialId: "owner-credential",
          rpId: "localhost",
          transports: ["internal"],
          signCount: 0,
        },
      });
      const scope = {
        id: key.id,
        organizationId: organization.id,
        credentialId: "owner-credential",
        expectedCounter: 0,
        nextCounter: 0,
      };
      const advance = repository.core.signingKey.advancePasskeyCounter;
      expect(yield* advance(scope)).toBeDefined();
      expect(yield* advance(scope)).toBeDefined();
      expect(
        yield* advance({ ...scope, credentialId: "other-credential", nextCounter: 1 }),
      ).toBeUndefined();
      expect(
        yield* advance({
          ...scope,
          organizationId: Schema.decodeSync(OrganizationId)("01900000-0000-7000-8000-000000000002"),
          nextCounter: 1,
        }),
      ).toBeUndefined();
      expect(yield* advance({ ...scope, nextCounter: 1 })).toBeDefined();
      expect(yield* advance({ ...scope, nextCounter: 2 })).toBeUndefined();
      expect(yield* advance({ ...scope, expectedCounter: 1, nextCounter: 0 })).toBeUndefined();
      expect(
        (yield* advance({ ...scope, expectedCounter: 1, nextCounter: 2 }))?.data,
      ).toMatchObject({ signCount: 2 });
      yield* repository.core.signingKey.setStatus(key.id, organization.id, "disabled");
      expect(yield* advance({ ...scope, expectedCounter: 2, nextCounter: 3 })).toBeUndefined();
    }),
  );
});
