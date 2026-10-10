import * as Secp256k1 from "ox/Secp256k1";
import {
  bytesToHex,
  hashMessage,
  hashTypedData,
  hexToBytes,
  numberToHex,
  concatHex,
  recoverAddress,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";

import { createSecp256k1OwnerAccount } from "../../../src/accounts/secp256k1.js";

describe("recoverable secp256k1 owner", () => {
  const key = privateKeyToAccount(generatePrivateKey());
  const digest = hashMessage("owner adapter test");

  it.each([0, 27])(
    "accepts recovery offset %i and signs exact digests without extra hashing",
    async (offset) => {
      const sign = vi.fn(async (hash: Uint8Array) => {
        const signature = hexToBytes(await key.sign({ hash: bytesToHex(hash) }));
        const recovery = signature[64];
        if (recovery === undefined) throw new Error("Missing test signature recovery byte");
        signature[64] = recovery - 27 + offset;
        return signature;
      });
      const owner = createSecp256k1OwnerAccount({
        publicKey: key.publicKey,
        signatureEncoding: "recoverable",
        sign,
      });
      expect(owner.signAuthorization).toBeUndefined();
      const signature = await owner.sign({ hash: digest });
      expect(sign).toHaveBeenLastCalledWith(hexToBytes(digest));
      expect(await recoverAddress({ hash: digest, signature })).toBe(key.address);

      await owner.signMessage({ message: "message" });
      expect(sign).toHaveBeenLastCalledWith(hexToBytes(hashMessage("message")));
      const typedData = {
        domain: { chainId: 1 },
        types: { Test: [{ name: "value", type: "uint256" }] },
        primaryType: "Test",
        message: { value: 1n },
      } as const;
      await owner.signTypedData(typedData);
      expect(sign).toHaveBeenLastCalledWith(hexToBytes(hashTypedData(typedData)));
    },
  );

  it("normalizes high-S and flips recovery parity", async () => {
    const low = await key.sign({ hash: digest });
    const order = Secp256k1.noble.Point.Fn.ORDER;
    const high = concatHex([
      low.slice(0, 66) as `0x${string}`,
      numberToHex(order - BigInt(`0x${low.slice(66, 130)}`), { size: 32 }),
      numberToHex(low.endsWith("1b") ? 28 : 27, { size: 1 }),
    ]);
    const owner = createSecp256k1OwnerAccount({
      publicKey: key.publicKey,
      signatureEncoding: "recoverable",
      sign: async () => hexToBytes(high),
    });
    expect(await owner.sign({ hash: digest })).toBe(low);
  });

  it("rejects signatures from another key, digest, bad length or recovery byte", async () => {
    const valid = hexToBytes(await key.sign({ hash: digest }));
    const badRecovery = valid.slice();
    badRecovery[64] = 2;
    const other = privateKeyToAccount(generatePrivateKey());
    await Promise.all(
      [
        valid.slice(0, 64),
        badRecovery,
        hexToBytes(await other.sign({ hash: digest })),
        hexToBytes(await key.sign({ hash: hashMessage("other") })),
      ].map(async (signature) => {
        const owner = createSecp256k1OwnerAccount({
          publicKey: key.publicKey,
          signatureEncoding: "recoverable",
          sign: async () => signature,
        });
        await expect(owner.sign({ hash: digest })).rejects.toThrow();
      }),
    );
  });

  it("rejects an invalid public point and EOA transaction signing", async () => {
    const sign = vi.fn(async () => new Uint8Array());
    expect(() =>
      createSecp256k1OwnerAccount({ publicKey: `0x04${"00".repeat(64)}`, sign }),
    ).toThrow();
    expect(sign).not.toHaveBeenCalled();
    const owner = createSecp256k1OwnerAccount({ publicKey: key.publicKey, sign });
    await expect(owner.sign({ hash: "0x01" })).rejects.toThrow("32-byte");
    await expect(
      owner.signTransaction({ chainId: 1, type: "legacy", gasPrice: 1n, gas: 21000n, nonce: 0 }),
    ).rejects.toThrow("EOA transactions");
    expect(sign).not.toHaveBeenCalled();
  });
});
