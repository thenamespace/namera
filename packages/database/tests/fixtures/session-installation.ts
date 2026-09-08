import { Effect, Schema } from "effect";

import { Bytes32, Email, EthereumAddress, PolicyId, SigningKeyId } from "@namera-ai/protocol";
import type { SessionKeyInstallationInsert } from "@namera-ai/protocol/model";
import { generateUniqueId } from "@namera-ai/utils";

import { Repository } from "../../src/index.js";

export const installationFixture = Effect.fn("test.installation.fixture")(function* (name: string) {
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
  const sessionSigner = yield* repository.core.signingKey.insert({
    id: SigningKeyId.make(generateUniqueId()),
    organizationId: organization.id,
    purpose: "session",
    custody: "local",
    algorithm: "secp256k1",
    status: "active",
    publicKeyHex: "0x04aabbdd",
    data: { version: 1, type: "local-key" },
  });
  const sessionKey = yield* repository.core.sessionKey.insert({
    organizationId: organization.id,
    walletId: wallet.id,
    signingKeyId: sessionSigner.id,
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
  return { input, organization, wallet, actor };
});
