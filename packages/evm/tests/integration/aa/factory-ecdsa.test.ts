import { Effect, Redacted, Schema } from "effect";

import { toModularAccountV2Base } from "@alchemy/smart-accounts";
import { EthereumAddress, EvmSessionAuthorization, Hex } from "@namera-ai/protocol";
import {
  bytesToHex,
  hexToBytes,
  parseAbi,
  parseEther,
  parseEventLogs,
  type TransactionReceipt,
} from "viem";
import { entryPoint07Abi } from "viem/account-abstraction";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";

import { createAlchemyModularV2Account } from "../../../src/accounts/alchemy-modular-v2.js";
import { ecdsaFactoryDeployment } from "../../../src/accounts/factory-ecdsa.js";
import { reconstructEvmAccount } from "../../../src/accounts/reconstruct.js";
import { createSecp256k1OwnerAccount } from "../../../src/accounts/secp256k1.js";
import { makeSignEvmExecution } from "../../../src/execution/sign.js";
import { normalizeEvmUserOperation } from "../../../src/execution/user-operation.js";
import { makeEvmSessionService } from "../../../src/sessions/service.js";
import { makeVerifyEvmSignature } from "../../../src/signing/verify.js";
import { preparedExecutionFixture } from "../../fixtures/prepared-execution.js";
import { makeAnvilChainFixture } from "./chain-fixture.js";

const anvilUrl = process.env.NAMERA_TEST_ANVIL_URL;
const succeeded = (receipt: TransactionReceipt) => {
  expect(receipt.status).toBe("success");
  const events = parseEventLogs({
    abi: entryPoint07Abi,
    eventName: "UserOperationEvent",
    logs: receipt.logs,
  });
  expect(events).toHaveLength(1);
  expect(events[0]?.args.success).toBe(true);
};

describe.skipIf(anvilUrl === undefined)("factory ECDSA account on a Sepolia Anvil fork", () => {
  it("derives, deploys, reconstructs, signs contract messages and installs/removes a restricted session", async () => {
    if (anvilUrl === undefined) throw new Error("NAMERA_TEST_ANVIL_URL is required");
    const { publicClient, fundAccount, submit } = await makeAnvilChainFixture(anvilUrl);
    const key = privateKeyToAccount(generatePrivateKey());
    const providerSign = vi.fn(async (hash: Uint8Array) =>
      hexToBytes(await key.sign({ hash: bytesToHex(hash) })),
    );
    const owner = {
      validatorType: "ecdsa_secp256k1",
      account: createSecp256k1OwnerAccount({
        publicKey: key.publicKey,
        signatureEncoding: "recoverable",
        sign: providerSign,
      }),
    } as const;
    const wallet = await Effect.runPromise(
      createAlchemyModularV2Account(
        {
          accountMode: "factory",
          entryPointVersion: "0.7",
          chainId: publicClient.chain.id,
          salt: 123n,
          owner,
        },
        {
          alchemyApiKey: Redacted.make("unused-offline-derivation"),
          alchemyBsoPolicyId: Redacted.make("unused"),
        },
      ),
    );
    const reconstruction = { wallet, owner };
    const account = await Effect.runPromise(reconstructEvmAccount(reconstruction, publicClient));
    expect(account.address).not.toBe(key.address);
    expect(account.authorization).toBeUndefined();
    expect(owner.account.signAuthorization).toBeUndefined();
    expect(providerSign).not.toHaveBeenCalled();
    expect(
      await publicClient.readContract({
        address: ecdsaFactoryDeployment.factory,
        abi: parseAbi([
          "function getAddressSemiModular(address owner, uint256 salt) view returns (address)",
        ]),
        functionName: "getAddressSemiModular",
        args: [key.address, 123n],
      }),
    ).toBe(account.address);

    const message = "factory owner proof";
    const typedData = {
      domain: { name: "Factory test", chainId: publicClient.chain.id },
      types: { Test: [{ name: "value", type: "uint256" }] },
      primaryType: "Test",
      message: { value: 1n },
    } as const;
    const messageSignature = Hex.make(await account.signMessage({ message }));
    const typedSignature = await account.signTypedData(typedData);
    const readOnlyOwner = {
      ...owner,
      account: createSecp256k1OwnerAccount({
        publicKey: key.publicKey,
        sign: async () => {
          throw new Error("Verification must never sign");
        },
      }),
    } as const;
    const verify = makeVerifyEvmSignature(() => ({ publicClient }));
    const verifyMessage = (value: string) =>
      Effect.runPromise(
        verify({
          account: { wallet, owner: readOnlyOwner },
          chainId: "eip155:11155111",
          type: "message",
          message: value,
          signature: messageSignature,
        }),
      );
    const factory = await account.getFactoryArgs();
    expect(await verifyMessage(message)).toBe(true);
    expect(await verifyMessage("wrong message")).toBe(false);
    expect(
      await publicClient.verifyTypedData({
        address: account.address,
        ...typedData,
        signature: typedSignature,
        ...factory,
      }),
    ).toBe(true);
    expect(await publicClient.getCode({ address: account.address })).toBeUndefined();

    await fundAccount(account.address);
    const recipient = EthereumAddress.make("0x0000000000000000000000000000000000006789");
    const amount = parseEther("0.001");
    const before = await publicClient.getBalance({ address: recipient });
    const calls = [{ to: recipient, value: amount, data: Hex.make("0x") }];
    const signExecution = makeSignEvmExecution(() => ({ publicClient }));
    const signedSubmit = async (signer: typeof account) =>
      submit(signer, await signer.encodeCalls(calls), async (operation) => {
        const prepared = preparedExecutionFixture(
          await Effect.runPromise(normalizeEvmUserOperation(operation)),
          calls,
        );
        return (await Effect.runPromise(signExecution({ account: reconstruction, prepared })))
          .userOperation.signature;
      });
    succeeded(await signedSubmit(account));
    const rebuilt = await Effect.runPromise(reconstructEvmAccount(reconstruction, publicClient));
    expect(rebuilt.address).toBe(account.address);
    expect(await rebuilt.getFactoryArgs()).toEqual({ factory: undefined, factoryData: undefined });
    succeeded(await signedSubmit(rebuilt));
    expect(await publicClient.getBalance({ address: recipient })).toBe(before + 2n * amount);
    expect(await verifyMessage(message)).toBe(true);
    expect(
      await publicClient.verifyTypedData({
        address: account.address,
        ...typedData,
        signature: typedSignature,
      }),
    ).toBe(true);
    expect(
      await publicClient.verifyTypedData({
        address: account.address,
        ...typedData,
        message: { value: 2n },
        signature: typedSignature,
      }),
    ).toBe(false);

    const sessions = makeEvmSessionService(() => ({ publicClient }), {
      prepare: () => Effect.die("Not used"),
    });
    const sessionKey = privateKeyToAccount(generatePrivateKey());
    const now = Number((await publicClient.getBlock()).timestamp);
    const authorization = Schema.decodeUnknownSync(EvmSessionAuthorization)({
      version: 1,
      entityId: 7,
      signerAddress: sessionKey.address,
      validAfter: now - 60,
      validUntil: now + 3600,
      permissions: [
        { type: "contract-access", address: recipient },
        { type: "native-token-transfer", allowance: amount.toString() },
      ],
    });
    const installation = await Effect.runPromise(
      sessions.compile({
        account: { wallet, owner: readOnlyOwner },
        chainId: "eip155:11155111",
        authorization,
      }),
    );
    succeeded(
      await submit(
        rebuilt,
        await rebuilt.encodeCalls([{ to: rebuilt.address, data: installation.installCallData }]),
      ),
    );
    const session = await toModularAccountV2Base({
      client: publicClient,
      owner: sessionKey,
      accountAddress: rebuilt.address,
      signerEntity: { entityId: 7, isGlobalValidation: false },
      getFactoryArgs: async () => ({}),
    });
    await expect(
      submit(session, await session.encodeCalls([{ to: key.address, value: 0n }])),
    ).rejects.toThrow();
    succeeded(await submit(session, await session.encodeCalls(calls)));
    expect(await publicClient.getBalance({ address: recipient })).toBe(before + 3n * amount);
    succeeded(
      await submit(
        rebuilt,
        await rebuilt.encodeCalls([{ to: rebuilt.address, data: installation.uninstallCallData }]),
      ),
    );
    await expect(
      submit(session, await session.encodeCalls([{ to: recipient, value: 0n }])),
    ).rejects.toThrow();
  }, 120_000);
});
