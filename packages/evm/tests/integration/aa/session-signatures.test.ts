import { Schema } from "effect";

import {
  DefaultModuleAddress,
  pack1271Signature,
  toReplaySafeTypedData,
} from "@alchemy/smart-accounts";
import { EvmSessionAuthorization } from "@namera-ai/protocol/evm";
import { concatHex, createClient, custom, hashMessage, hashTypedData, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import { compileEvmSession } from "../../../src/sessions/compile.js";
import { makeAnvilFixture } from "./fixture.js";

const anvilUrl = process.env.NAMERA_TEST_ANVIL_URL;

describe.skipIf(anvilUrl === undefined)("onchain session signature authority", () => {
  it("requires explicit approval, binds replay domains, and ends only on uninstall", async () => {
    if (anvilUrl === undefined) throw new Error("NAMERA_TEST_ANVIL_URL is required");
    const { account, publicClient, submit, advanceTime } = await makeAnvilFixture(anvilUrl);
    const key = privateKeyToAccount(generatePrivateKey());
    const client = createClient({
      account,
      chain: publicClient.chain,
      transport: custom(publicClient),
    });
    const now = Number((await publicClient.getBlock()).timestamp);
    const authorization = Schema.decodeUnknownSync(EvmSessionAuthorization)({
      version: 1,
      entityId: 1,
      signerAddress: key.address,
      validAfter: now - 60,
      validUntil: now + 300,
      permissions: [{ type: "root" }],
    });
    const disabled = await compileEvmSession(client, authorization);
    await submit(
      account,
      await account.encodeCalls([{ to: account.address, data: disabled.installCallData }]),
    );

    const signHash = async (
      hash: Hex,
      entityId: number,
      chainId = publicClient.chain.id,
      walletAddress = account.address,
    ) =>
      pack1271Signature({
        entityId,
        validationSignaturePrefix: "0x00",
        validationSignature: await key.signTypedData(
          toReplaySafeTypedData({
            address: DefaultModuleAddress.SINGLE_SIGNER_VALIDATION,
            chainId,
            hash,
            salt: concatHex([`0x${"00".repeat(12)}`, walletAddress]),
          }),
        ),
      });
    const messageHash = hashMessage("Approve this message, not a transaction");
    const verify = (hash: Hex, signature: Hex) =>
      publicClient.verifyHash({ address: account.address, hash, signature });
    expect(await verify(messageHash, await signHash(messageHash, 1))).toBe(false);

    const enabled = await compileEvmSession(client, {
      ...authorization,
      entityId: 2,
      allowSignatures: true,
    });
    await submit(
      account,
      await account.encodeCalls([{ to: account.address, data: enabled.installCallData }]),
    );
    const messageSignature = await signHash(messageHash, 2);
    expect(await verify(messageHash, messageSignature)).toBe(true);
    expect(await verify(hashMessage("Different message"), messageSignature)).toBe(false);
    expect(await verify(messageHash, await signHash(messageHash, 2, 1))).toBe(false);
    expect(
      await verify(messageHash, await signHash(messageHash, 2, publicClient.chain.id, key.address)),
    ).toBe(false);
    const typedHash = hashTypedData({
      domain: { name: "Session signature test", chainId: publicClient.chain.id },
      types: { Consent: [{ name: "action", type: "string" }] },
      primaryType: "Consent",
      message: { action: "Sign typed data" },
    });
    const typedSignature = await signHash(typedHash, 2);
    expect(await verify(typedHash, typedSignature)).toBe(true);

    // Alchemy's TimeRange hook deliberately does not expire ERC-1271 authority.
    // Keep this explicit so API lifetime checks are never sold as onchain safety.
    await advanceTime(600);
    expect(await verify(messageHash, messageSignature)).toBe(true);

    await submit(
      account,
      await account.encodeCalls([{ to: account.address, data: enabled.uninstallCallData }]),
    );
    expect(await verify(messageHash, messageSignature)).toBe(false);
    expect(await verify(typedHash, typedSignature)).toBe(false);
  }, 30_000);
});
