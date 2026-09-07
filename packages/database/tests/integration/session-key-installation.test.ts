import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Layer, Schema } from "effect";

import {
  Bytes32,
  Email,
  EthereumAddress,
  PolicyId,
  SigningKeyId,
  TransactionHash,
  UserOperationHash,
} from "@namera-ai/protocol";
import type { SessionKeyInstallationInsert } from "@namera-ai/protocol/model";
import { generateUniqueId } from "@namera-ai/utils";

import { Repository, TestDatabase } from "../../src/index.js";

const Persistence = Repository.layer.pipe(Layer.provideMerge(TestDatabase.layer));
const hash = Schema.decodeSync(UserOperationHash)(`0x${"11".repeat(32)}`);
const otherHash = Schema.decodeSync(UserOperationHash)(`0x${"22".repeat(32)}`);
const transactionHash = Schema.decodeSync(TransactionHash)(`0x${"33".repeat(32)}`);

const fixture = Effect.fn("test.installation.fixture")(function* (name: string) {
  const repository = yield* Repository;
  const user = yield* repository.auth.user.create({
    email: Schema.decodeSync(Email)(`${name}@namera.test`),
    metadata: { version: 1 },
  });
  const organization = yield* repository.auth.organization.insert({
    createdById: user.id,
    metadata: { version: 1, name },
  });
  const actor = yield* repository.auth.actor.insert({
    organizationId: organization.id,
    type: "user",
  });
  const key = yield* repository.core.signingKey.insert({
    id: Schema.decodeSync(SigningKeyId)(generateUniqueId()),
    organizationId: organization.id,
    purpose: "wallet-root",
    status: "active",
    custody: "local",
    algorithm: "p256",
    publicKeyHex: "0x04aabbcc",
    data: {
      version: 1,
      type: "passkey",
      credentialId: name,
      rpId: "localhost",
      transports: ["internal"],
      signCount: 0,
    },
  });
  const address = Schema.decodeSync(EthereumAddress)(`0x${"12".repeat(20)}`);
  const wallet = yield* repository.core.wallet.insert({
    organizationId: organization.id,
    signingKeyId: key.id,
    createdByActorId: actor.id,
    namespace: "eip155",
    metadata: { version: 1, name },
    status: "active",
    data: {
      version: 1,
      address,
      implementation: "alchemy-modular-v2",
      modularAccountVersion: "2.0.0",
      entryPointVersion: "0.7",
      validatorType: "webauthn_p256",
      salt: 0n,
      entityId: 0,
    },
  });
  const sessionKey = yield* repository.core.sessionKey.insert({
    organizationId: organization.id,
    walletId: wallet.id,
    createdByActorId: actor.id,
    namespace: "eip155",
    metadata: { version: 1, name },
    policyHash: "fixture",
    policies: [
      {
        id: Schema.decodeSync(PolicyId)("01900000-0000-7000-8000-000000000001"),
        type: "evm.signature",
        version: 1,
        appliesTo: "signature",
        allowedTypes: ["message"],
      },
    ],
  });
  const input: SessionKeyInstallationInsert = {
    organizationId: organization.id,
    sessionKeyId: sessionKey.id,
    walletId: wallet.id,
    namespace: "eip155",
    chainId: "eip155:11155111",
    entityId: 1,
    configurationHash: Schema.decodeSync(Bytes32)(`0x${"44".repeat(32)}`),
    data: {
      version: 1,
      authorization: {
        version: 1,
        entityId: 1,
        signerAddress: address,
        permissions: [{ type: "root" }],
        validAfter: 0,
        validUntil: 100,
      },
      moduleAddress: address,
      isGlobal: true,
      installCallData: "0xab",
      uninstallCallData: "0xcd",
      hooks: [],
    },
  };
  return { input, organization, wallet };
});

layer(Persistence)("session installation persistence", (it) => {
  it.effect("requires matching receipts, preserves terminal revocation and isolates tenants", () =>
    Effect.gen(function* () {
      yield* (yield* TestDatabase).reset;
      const repository = (yield* Repository).core.sessionKeyInstallation;
      const owner = yield* fixture("installation-owner");
      const other = yield* fixture("installation-other");
      const installed = yield* repository.insert(owner.input);
      const scope = { id: installed.id, organizationId: owner.organization.id };
      const confirmation = {
        ...scope,
        userOperationHash: hash,
        transactionHash,
        confirmedAt: yield* DateTime.now,
      };
      expect(
        yield* repository.findById({ ...scope, organizationId: other.organization.id }),
      ).toBeUndefined();
      expect(yield* repository.markInstalled(confirmation)).toBeUndefined();
      expect((yield* repository.markSubmitted({ ...scope, userOperationHash: hash }))?.status).toBe(
        "submitted",
      );
      expect(
        yield* repository.markSubmitted({ ...scope, userOperationHash: otherHash }),
      ).toBeUndefined();
      expect(
        yield* repository.markInstalled({ ...confirmation, userOperationHash: otherHash }),
      ).toBeUndefined();
      expect((yield* repository.markInstalled(confirmation))?.status).toBe("installed");
      expect((yield* repository.beginRevocation(scope))?.status).toBe("revoking");
      expect(yield* repository.markRevoked(confirmation)).toBeUndefined();
      yield* repository.markRevocationSubmitted({ ...scope, userOperationHash: otherHash });
      expect(
        (yield* repository.markRevoked({ ...confirmation, userOperationHash: otherHash }))?.status,
      ).toBe("revoked");
      expect(yield* repository.markInstalled(confirmation)).toBeUndefined();
      expect(yield* repository.beginRevocation(scope)).toBeUndefined();
    }),
  );

  it.effect(
    "enforces tenant/wallet ownership, entity binding, unique chains and receipt requirements in PostgreSQL",
    () =>
      Effect.gen(function* () {
        yield* (yield* TestDatabase).reset;
        const repository = (yield* Repository).core.sessionKeyInstallation;
        const owner = yield* fixture("installation-constraints");
        const other = yield* fixture("installation-cross-tenant");
        const reject = (input: SessionKeyInstallationInsert) =>
          repository.insert(input).pipe(
            Effect.as(false),
            Effect.catchTag("DatabaseError", () => Effect.succeed(true)),
          );
        expect(yield* reject({ ...owner.input, organizationId: other.organization.id })).toBe(true);
        expect(yield* reject({ ...owner.input, walletId: other.wallet.id })).toBe(true);
        expect(yield* reject({ ...owner.input, entityId: 2 })).toBe(true);
        expect(yield* reject({ ...owner.input, status: "installed" })).toBe(true);
        yield* repository.insert(owner.input);
        expect(yield* reject(owner.input)).toBe(true);
        expect(
          yield* repository.findForSession(owner.organization.id, owner.input.sessionKeyId),
        ).toHaveLength(1);
      }),
  );
});
