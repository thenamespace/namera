import { randomBytes, createHash } from "node:crypto";

import { expect, layer } from "@effect/vitest";
import { ConfigProvider, Crypto, DateTime, Effect, Layer, Ref, Schema } from "effect";
import { TestClock } from "effect/testing";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TestDatabase, TransactionService } from "@namera-ai/database";
import { Evm, createSecp256k1OwnerAccount } from "@namera-ai/evm";
import { Email } from "@namera-ai/protocol";
import { SigningKey } from "@namera-ai/protocol/model";
import { OneClawTestControl, oneClawAccountTestLayer } from "@namera-ai/wallet-provider-oneclaw";

import { Audit } from "../../src/audit/layer.js";
import { makeLoadOneClawOwner } from "../../src/oneclaw/owner.js";
import { makeProvisionOneClawSigner } from "../../src/oneclaw/provision.js";

const Persistence = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provideMerge(TestDatabase.layer),
);
const CryptoLive = CryptoService.layer.pipe(
  Layer.provide(
    Layer.succeed(
      Crypto.Crypto,
      Crypto.make({
        randomBytes,
        digest: (algorithm, bytes) =>
          Effect.sync(
            () =>
              new Uint8Array(
                createHash(algorithm.replace("-", "").toLowerCase()).update(bytes).digest(),
              ),
          ),
      }),
    ),
  ),
);
const Dependencies = Layer.mergeAll(
  Persistence,
  CryptoLive,
  oneClawAccountTestLayer(),
  Evm.testLayer,
);
const Live = Layer.mergeAll(Dependencies, Audit.layer.pipe(Layer.provide(Dependencies))).pipe(
  Layer.provideMerge(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown({
        ONECLAW_PLATFORM_APP_ID: "test-app",
        ONECLAW_ORG_EMAIL_DOMAIN: "example.invalid",
        CRYPTO_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        CRYPTO_HMAC_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      }),
    ),
  ),
);

const fixture = Effect.gen(function* () {
  yield* (yield* TestDatabase).reset;
  yield* TestClock.setTime(DateTime.toEpochMillis(DateTime.nowUnsafe()));
  const repository = yield* Repository;
  const user = yield* repository.auth.user.create({
    email: Email.make("owner@example.invalid"),
    metadata: { version: 1 },
  });
  const org = yield* repository.auth.organization.insert({
    createdById: user.id,
    metadata: { version: 1, name: "Owner" },
  });
  const actor = yield* repository.auth.actor.insert({ organizationId: org.id, type: "user" });
  const provision = yield* makeProvisionOneClawSigner;
  const prepared = yield* provision({
    organizationId: org.id,
    actorId: actor.id,
    purpose: "wallet-root",
  });
  const signingKey = yield* repository.core.signingKey.insert(prepared.signingKey);
  const data = yield* (yield* Evm).createAccount({
    accountMode: "factory",
    chainId: 1,
    entryPointVersion: "0.7",
    salt: 0n,
    owner: {
      validatorType: "ecdsa_secp256k1",
      account: createSecp256k1OwnerAccount({
        publicKey: signingKey.publicKeyHex,
        sign: async () => {
          throw new Error("Derivation must not sign");
        },
      }),
    },
  });
  const wallet = yield* repository.core.wallet.insert({
    organizationId: org.id,
    signingKeyId: signingKey.id,
    createdByActorId: actor.id,
    namespace: "eip155",
    status: "active",
    metadata: { version: 1, name: "Owner" },
    data,
  });
  const view = yield* repository.core.wallet.findById(wallet.id, org.id);
  if (!view) return yield* Effect.die("Missing owner fixture");
  const load = yield* makeLoadOneClawOwner;
  const control = yield* OneClawTestControl;
  yield* Ref.set(control.calls, []);
  return { view, load, repository, control, prepared };
});
const hash = `0x${"ab".repeat(32)}` as const;

layer(Live)("1Claw owner signing", (it) => {
  it.effect("signs the exact digest with a cryptographically verified recoverable signature", () =>
    Effect.gen(function* () {
      const { view, load, control } = yield* fixture;
      const owner = yield* load(view);
      // The EVM owner adapter verifies the returned signature against this hash and public key.
      const signature = yield* Effect.promise(() => owner.sign({ hash }));
      expect(signature).toHaveLength(132);
      expect(yield* Ref.get(control.calls)).toEqual(["signing.signDigest"]);
      expect("signAuthorization" in owner).toBe(false);
    }),
  );
  it.effect("rechecks connection revocation after loading an owner", () =>
    Effect.gen(function* () {
      const { view, load, control, repository, prepared } = yield* fixture;
      const owner = yield* load(view);
      yield* repository.core.providerConnections.disable({
        id: prepared.connection.id,
        organizationId: view.wallet.organizationId,
      });
      expect(yield* Effect.tryPromise(() => owner.sign({ hash })).pipe(Effect.isFailure)).toBe(
        true,
      );
      expect(yield* Ref.get(control.calls)).toEqual([]);
    }),
  );
  it.effect("rechecks signing-key revocation and rejects foreign organization views", () =>
    Effect.gen(function* () {
      const { view, load, control, repository } = yield* fixture;
      const owner = yield* load(view);
      yield* repository.core.signingKey.setStatus(
        view.signingKey.id,
        view.wallet.organizationId,
        "disabled",
      );
      expect(yield* Effect.tryPromise(() => owner.sign({ hash })).pipe(Effect.isFailure)).toBe(
        true,
      );
      const other = yield* repository.auth.organization.insert({
        createdById: (yield* repository.auth.user.create({
          email: Email.make("other@example.invalid"),
          metadata: { version: 1 },
        })).id,
        metadata: { version: 1, name: "Other" },
      });
      expect(
        yield* load({ ...view, wallet: { ...view.wallet, organizationId: other.id } }).pipe(
          Effect.isFailure,
        ),
      ).toBe(true);
      expect(yield* Ref.get(control.calls)).toEqual([]);
    }),
  );
  it.effect("rejects mismatched agent bindings without provider fallback", () =>
    Effect.gen(function* () {
      const { view, load, control, repository } = yield* fixture;
      const credentialId = view.signingKey.credentialId;
      if (!credentialId) return yield* Effect.die("Missing credential");
      const credential = yield* repository.core.credentials.findById(
        credentialId,
        view.wallet.organizationId,
      );
      if (!credential) return yield* Effect.die("Missing credential");
      const crypto = yield* CryptoService;
      const payload = yield* crypto.decrypt({
        purpose: cryptoPurpose.providerCredential,
        value: credential.encryptedPayload,
      });
      expect(payload).toContain("test-agent-key");
      // A different key locator is rejected before the credential can be used.
      if (view.signingKey.data.type !== "1claw") return yield* Effect.die("Missing 1Claw key");
      const owner = yield* load({
        ...view,
        signingKey: Schema.decodeUnknownSync(Schema.toType(SigningKey))({
          ...view.signingKey,
          data: { ...view.signingKey.data, agentId: "foreign-agent" },
        }),
      });
      expect(yield* Effect.tryPromise(() => owner.sign({ hash })).pipe(Effect.isFailure)).toBe(
        true,
      );
      expect(yield* Ref.get(control.calls)).toEqual([]);
    }),
  );
});
