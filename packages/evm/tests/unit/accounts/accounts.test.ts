import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { EthereumAddress } from "@namera-ai/protocol";
import * as PublicKey from "ox/PublicKey";
import * as Secp256k1 from "ox/Secp256k1";
import * as Signature from "ox/Signature";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { recoverAuthorizationAddress } from "viem/utils";

import { makeAlchemyModularV2Account } from "../../../src/accounts/alchemy-modular-v2.js";
import { reconstructEvmAccount } from "../../../src/accounts/reconstruct.js";
import { createWalletKeySecp256k1Account } from "../../../src/accounts/secp256k1.js";

const privateKey = `0x${"01".repeat(32)}` as const;
const publicKey = PublicKey.toHex(Secp256k1.getPublicKey({ privateKey }));
const expectedOwner = privateKeyToAccount(privateKey);

const ownerAccount = createWalletKeySecp256k1Account({
  publicKey,
  sign: async (hash) =>
    Signature.toDerBytes(Secp256k1.sign({ payload: hash, privateKey, extraEntropy: false })),
});

const owner = {
  validatorType: "ecdsa_secp256k1" as const,
  account: ownerAccount,
};

const publicClient = createPublicClient({ chain: sepolia, transport: http() });

it("adapts a provider-neutral secp256k1 signer into a valid 7702 owner", async () => {
  expect(ownerAccount.address).toBe(expectedOwner.address);

  const authorization = await ownerAccount.signAuthorization({
    address: "0x77021100bD87b7008E5E1989d0eB38555d0d0000",
    chainId: sepolia.id,
    nonce: 0,
  });

  expect(await recoverAuthorizationAddress({ authorization })).toBe(expectedOwner.address);
});

it("constructs Alchemy Modular Account V2 in 7702 mode from a secp256k1 owner", async () => {
  const account = await makeAlchemyModularV2Account(
    {
      entryPointVersion: "0.7",
      delegationVersion: "v1.0.0",
      owner,
    },
    publicClient,
  );

  expect(account.address).toBe(expectedOwner.address);
  expect(await account.getFactoryArgs()).toEqual({ factory: undefined, factoryData: undefined });
});

it.effect("rejects reconstruction when persisted validator metadata and owner differ", () =>
  Effect.gen(function* () {
    const error = yield* Effect.flip(
      reconstructEvmAccount(
        {
          wallet: {
            version: 1,
            implementation: "alchemy-modular-v2",
            modularAccountVersion: "2.0.0",
            entryPointVersion: "0.7",
            validatorType: "webauthn_p256",
            salt: 0n,
            entityId: 0,
            address: EthereumAddress.make("0x1111111111111111111111111111111111111111"),
          },
          owner,
        },
        publicClient,
      ),
    );

    expect(error.code).toBe("ACCOUNT_RECONSTRUCTION_FAILED");
  }),
);
