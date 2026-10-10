import { generateKeyPairSync, sign } from "node:crypto";

import { EthereumAddress } from "@namera-ai/protocol";
import * as P256 from "ox/P256";
import * as Signature from "ox/Signature";
import {
  numberToHex,
  type Hex,
  type PublicClient,
  type Chain,
  type Transport,
  type TransactionReceipt,
} from "viem";
import {
  type SmartAccount,
  type UserOperation,
  type WebAuthnAccount,
} from "viem/account-abstraction";

import { makeAlchemyModularV2Account } from "../../../src/accounts/alchemy-modular-v2.js";
import type { ReconstructEvmAccountInput } from "../../../src/accounts/types.js";
import {
  createPublicKeyWebAuthnAccount,
  createWalletKeyWebAuthnAccount,
} from "../../../src/accounts/webauthn.js";
import { makeAnvilChainFixture } from "./chain-fixture.js";

export const makeAnvilFixture = async (
  url: string,
): Promise<{
  readonly account: SmartAccount;
  readonly owner: WebAuthnAccount;
  readonly reconstruction: ReconstructEvmAccountInput;
  readonly publicClient: PublicClient<Transport, Chain>;
  readonly submit: (
    signer: SmartAccount,
    callData: Hex,
    signOperation?: (operation: UserOperation<"0.7">) => Promise<Hex>,
  ) => Promise<TransactionReceipt>;
  readonly advanceTime: (seconds: number) => Promise<void>;
  readonly deployContract: (bytecode: Hex) => Promise<`0x${string}`>;
}> => {
  const chain = await makeAnvilChainFixture(url);
  const { publicClient } = chain;
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  if (jwk.x === undefined || jwk.y === undefined) throw new Error("Missing P-256 coordinates");
  const publicKeyHex =
    `0x04${Buffer.from(jwk.x, "base64url").toString("hex")}${Buffer.from(jwk.y, "base64url").toString("hex")}` as Hex;
  const owner = createWalletKeyWebAuthnAccount({
    id: Buffer.from("local-aa-test").toString("base64url"),
    publicKey: publicKeyHex,
    origin: "http://localhost:3000",
    rpId: "localhost",
    validatorType: "webauthn_p256",
    sign: async (payload) => {
      const signature = Signature.fromDerBytes(sign("sha256", payload, privateKey));
      const order = P256.noble.Point.Fn.ORDER;
      const s = BigInt(signature.s);
      // Authenticators may return either half of the curve; exercise high-S deterministically.
      return Signature.toDerBytes({
        ...signature,
        s: numberToHex(s > order / 2n ? s : order - s, { size: 32 }),
      });
    },
  });
  const account = await makeAlchemyModularV2Account(
    {
      entryPointVersion: "0.7",
      salt: 0n,
      entityId: 0,
      owner: { validatorType: "webauthn_p256", account: owner },
    },
    publicClient,
  );
  await chain.fundAccount(account.address);
  return {
    ...chain,
    account,
    owner,
    reconstruction: {
      wallet: {
        version: 1,
        address: EthereumAddress.make(account.address),
        implementation: "alchemy-modular-v2",
        modularAccountVersion: "2.0.0",
        entryPointVersion: "0.7",
        validatorType: "webauthn_p256",
        salt: 0n,
        entityId: 0,
      },
      owner: {
        validatorType: "webauthn_p256",
        account: createPublicKeyWebAuthnAccount(owner.publicKey),
      },
    },
  };
};
