import { Effect } from "effect";
import * as Base64Url from "effect/encoding/Base64Url";

import { EthereumAddress } from "@namera-ai/protocol";
import {
  createPublicClient,
  custom,
  encodeAbiParameters,
  hexToBytes,
  isErc6492Signature,
  parseErc6492Signature,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";

import { makeFactoryEcdsaAccount } from "../../../src/accounts/factory-ecdsa.js";
import { createSecp256k1OwnerAccount } from "../../../src/accounts/secp256k1.js";
import { createPublicKeyWebAuthnAccount } from "../../../src/accounts/webauthn.js";
import { makeEvmOwnerSignatureService } from "../../../src/signing/owner.js";
import type { SignEvmInput } from "../../../src/signing/types.js";

const address = EthereumAddress.make("0x1111111111111111111111111111111111111111");
const client = (deployed: boolean) =>
  createPublicClient({
    chain: mainnet,
    transport: custom({
      request: async ({ method }) => {
        if (method === "eth_getCode") return deployed ? "0x6000" : "0x";
        if (method === "eth_call") return encodeAbiParameters([{ type: "address" }], [address]);
        throw new Error(`Unexpected RPC ${method}`);
      },
    }),
  });
const base = {
  version: 1,
  implementation: "alchemy-modular-v2",
  modularAccountVersion: "2.0.0",
  entryPointVersion: "0.7",
  address,
  salt: 0n,
} as const;

describe("owner signature envelopes", () => {
  for (const deployed of [false, true]) {
    it(`wraps managed signatures only when undeployed (${deployed}) without signing during prepare`, async () => {
      const key = privateKeyToAccount(`0x${"01".repeat(32)}`);
      const sign = vi.fn(async (hash: Uint8Array) =>
        hexToBytes(await key.sign({ hash: `0x${Buffer.from(hash).toString("hex")}` })),
      );
      const owner = {
        validatorType: "ecdsa_secp256k1" as const,
        account: createSecp256k1OwnerAccount({
          publicKey: key.publicKey,
          signatureEncoding: "recoverable",
          sign,
        }),
      };
      const derived = await makeFactoryEcdsaAccount(
        { accountMode: "factory", salt: 0n, entryPointVersion: "0.7", owner },
        client(deployed),
      );
      const input: SignEvmInput = {
        chainId: "eip155:1",
        type: "message",
        message: "Upload avatar",
        account: {
          wallet: {
            ...base,
            address: EthereumAddress.make(derived.address),
            validatorType: "ecdsa_secp256k1",
            accountMode: "factory",
            factoryVersion: "2.0.0",
            implementationVersion: "v1.0.0",
            ownerAddress: EthereumAddress.make(key.address),
          },
          owner,
        },
      };
      const service = makeEvmOwnerSignatureService(() => ({ publicClient: client(deployed) }));
      expect(await Effect.runPromise(service.prepare(input))).toBeNull();
      expect(sign).not.toHaveBeenCalled();
      const signature = await Effect.runPromise(service.complete(input));
      expect(sign).toHaveBeenCalledOnce();
      expect(isErc6492Signature(signature)).toBe(!deployed);
      if (!deployed) expect(parseErc6492Signature(signature).data?.length).toBeGreaterThan(10);
    });
    it(`packs a verified passkey assertion and binds its challenge (${deployed})`, async () => {
      const input: SignEvmInput = {
        chainId: "eip155:1",
        type: "message",
        message: "Upload avatar",
        account: {
          wallet: { ...base, validatorType: "webauthn_p256", entityId: 0 },
          owner: {
            validatorType: "webauthn_p256",
            account: createPublicKeyWebAuthnAccount(`0x04${"01".repeat(64)}`),
          },
        },
      };
      const service = makeEvmOwnerSignatureService(() => ({ publicClient: client(deployed) }));
      const challenge = await Effect.runPromise(service.prepare(input));
      if (!challenge) throw new Error("Expected challenge");
      const assertion = {
        authenticatorDataHex: "0x0102" as const,
        signatureDerHex: "0x3006020101020101" as const,
        clientDataJSON: JSON.stringify({
          type: "webauthn.get",
          challenge: Base64Url.encode(hexToBytes(challenge)),
        }),
      };
      const signature = await Effect.runPromise(service.complete({ ...input, assertion }));
      expect(isErc6492Signature(signature)).toBe(!deployed);
      const inner = deployed ? signature : parseErc6492Signature(signature).signature;
      expect(inner.startsWith("0x0000000000ff")).toBe(true);
      await expect(
        Effect.runPromise(service.complete({ ...input, message: "Other request", assertion })),
      ).rejects.toThrow();
    });
  }
});
