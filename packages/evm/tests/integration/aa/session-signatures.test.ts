import { Effect, Schema } from "effect";

import {
  DefaultModuleAddress,
  pack1271Signature,
  toReplaySafeTypedData,
} from "@alchemy/smart-accounts";
import { EvmSessionAuthorization, Hex as ProtocolHex } from "@namera-ai/protocol/evm";
import {
  concatHex,
  createClient,
  custom,
  hashMessage,
  hashTypedData,
  type Hex,
  type TypedDataDefinition,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";

import { compileEvmSession } from "../../../src/sessions/compile.js";
import { makeEvmSessionService } from "../../../src/sessions/service.js";
import { makeEvmSessionSignatureService } from "../../../src/signing/session.js";
import { makeAnvilFixture } from "./fixture.js";

const anvilUrl = process.env.NAMERA_TEST_ANVIL_URL;

describe.skipIf(anvilUrl === undefined)("onchain session signature authority", () => {
  it("requires explicit approval, binds replay domains, and ends only on uninstall", async () => {
    if (anvilUrl === undefined) throw new Error("NAMERA_TEST_ANVIL_URL is required");
    const { account, reconstruction, publicClient, submit, advanceTime } =
      await makeAnvilFixture(anvilUrl);
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

    const sessions = makeEvmSessionService(() => ({ publicClient }), {
      prepare: () => Effect.die(new Error("Signature preparation must not prepare UserOperations")),
    });
    const enabled = await Effect.runPromise(
      sessions.compile({
        account: reconstruction,
        chainId: "eip155:11155111",
        authorization: { ...authorization, entityId: 2, allowSignatures: true },
      }),
    );
    const signatures = makeEvmSessionSignatureService(() => ({ publicClient }));
    const signingInput = {
      account: reconstruction,
      chainId: "eip155:11155111",
      session: enabled,
      type: "message",
      message: "Approve this message, not a transaction",
    } as const;
    const typedData = await Effect.runPromise(signatures.prepare(signingInput));
    const localSignature = ProtocolHex.make(
      await key.signTypedData(typedData as unknown as TypedDataDefinition),
    );
    expect(
      await Effect.runPromise(
        signatures.complete({ ...signingInput, signature: localSignature }).pipe(Effect.flip),
      ),
    ).toMatchObject({ code: "VERIFICATION_FAILED" });
    await submit(
      account,
      await account.encodeCalls([{ to: account.address, data: enabled.installCallData }]),
    );
    const messageSignature = await Effect.runPromise(
      signatures.complete({ ...signingInput, signature: localSignature }),
    );
    expect(messageSignature).toBe(await signHash(messageHash, 2));
    expect(
      await Effect.runPromise(
        signatures
          .complete({ ...signingInput, message: "Changed", signature: localSignature })
          .pipe(Effect.flip),
      ),
    ).toMatchObject({ code: "SIGNING_FAILED" });
    expect(
      await Effect.runPromise(
        signatures
          .prepare({
            ...signingInput,
            session: {
              ...enabled,
              authorization: { ...enabled.authorization, allowSignatures: false },
            },
          })
          .pipe(Effect.flip),
      ),
    ).toMatchObject({ code: "SIGNING_FAILED" });
    expect(await verify(messageHash, messageSignature)).toBe(true);
    expect(await verify(hashMessage("Different message"), messageSignature)).toBe(false);
    expect(await verify(messageHash, await signHash(messageHash, 2, 1))).toBe(false);
    expect(
      await verify(messageHash, await signHash(messageHash, 2, publicClient.chain.id, key.address)),
    ).toBe(false);
    const requestTypedData = {
      domain: { name: "Session signature test", chainId: publicClient.chain.id },
      types: { Consent: [{ name: "action", type: "string" }] },
      primaryType: "Consent",
      message: { action: "Sign typed data" },
    } as const;
    const typedHash = hashTypedData(requestTypedData);
    const typedInput = {
      ...signingInput,
      type: "typed-data" as const,
      typedData: requestTypedData,
    };
    const typedChallenge = await Effect.runPromise(signatures.prepare(typedInput));
    const typedSignature = await Effect.runPromise(
      signatures.complete({
        ...typedInput,
        signature: ProtocolHex.make(
          await key.signTypedData(typedChallenge as unknown as TypedDataDefinition),
        ),
      }),
    );
    expect(typedSignature).toBe(await signHash(typedHash, 2));
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
    expect(
      await Effect.runPromise(
        signatures.complete({ ...signingInput, signature: localSignature }).pipe(Effect.flip),
      ),
    ).toMatchObject({ code: "VERIFICATION_FAILED" });
  }, 30_000);
});
