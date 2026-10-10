import { Effect, Redacted } from "effect";

import { EthereumAddress, Hex } from "@namera-ai/protocol";
import {
  bytesToHex,
  createPublicClient,
  custom,
  hexToBytes,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { describe, expect, it, vi } from "vitest";

import {
  createAlchemyModularV2Account,
  makeAlchemyModularV2Account,
} from "../../../src/accounts/alchemy-modular-v2.js";
import { ecdsaFactoryDeployment } from "../../../src/accounts/factory-ecdsa.js";
import { reconstructEvmAccount } from "../../../src/accounts/reconstruct.js";
import { createSecp256k1OwnerAccount } from "../../../src/accounts/secp256k1.js";
import { makeReconstructPreparedAccount } from "../../../src/execution/prepared-account.js";
import { normalizeEvmUserOperation } from "../../../src/execution/user-operation.js";
import { preparedExecutionFixture } from "../../fixtures/prepared-execution.js";

const setup = async (deployed = false) => {
  const key = privateKeyToAccount(generatePrivateKey());
  const sign = vi.fn(async (hash: Uint8Array) =>
    hexToBytes(await key.sign({ hash: bytesToHex(hash) })),
  );
  const owner = {
    validatorType: "ecdsa_secp256k1",
    account: createSecp256k1OwnerAccount({
      publicKey: key.publicKey,
      signatureEncoding: "recoverable",
      sign,
    }),
  } as const;
  const client = createPublicClient({
    chain: sepolia,
    transport: custom({
      request: async ({ method }) => {
        if (method === "eth_getCode") return deployed ? "0x6000" : "0x";
        if (method === "eth_call")
          return encodeAbiParameters(
            parseAbiParameters("(uint8, bytes25[], bytes25[], bytes4[])"),
            [[0, [], [], []]],
          );
        throw new Error(`Unexpected RPC ${method}`);
      },
    }),
  });
  const props = { accountMode: "factory", entryPointVersion: "0.7", salt: 42n, owner } as const;
  const wallet = await Effect.runPromise(
    createAlchemyModularV2Account(
      { ...props, chainId: sepolia.id },
      { alchemyApiKey: Redacted.make("test"), alchemyBsoPolicyId: Redacted.make("test") },
    ),
  );
  if (wallet.validatorType !== "ecdsa_secp256k1" || wallet.accountMode !== "factory")
    throw new Error("Expected factory wallet");
  return { client, props, wallet, owner, sign };
};

describe("factory ECDSA account", () => {
  it("derives a stable address distinct from its owner and reconstructs without 7702 authority", async () => {
    const { client, props, wallet, owner, sign } = await setup();
    const first = await makeAlchemyModularV2Account(props, client);
    const second = await Effect.runPromise(reconstructEvmAccount({ wallet, owner }, client));
    expect(first.address).toBe(second.address);
    expect(first.address.toLowerCase()).toBe(wallet.address.toLowerCase());
    expect(first.address).not.toBe(owner.account.address);
    expect(first.authorization).toBeUndefined();
    expect((await first.getFactoryArgs()).factory).toBe(ecdsaFactoryDeployment.factory);
    expect(sign).not.toHaveBeenCalled();
    const different = await makeAlchemyModularV2Account({ ...props, salt: 43n }, client);
    expect(different.address).not.toBe(first.address);
  });

  it("omits deployment data when reconstructing an already-deployed account", async () => {
    const { client, wallet, owner } = await setup(true);
    const account = await Effect.runPromise(reconstructEvmAccount({ wallet, owner }, client));
    expect(await account.getFactoryArgs()).toEqual({ factory: undefined, factoryData: undefined });
  });

  it("rejects corrupted owner, versions, salt or stored account before signing", async () => {
    const { client, wallet, owner, sign } = await setup();
    const address = EthereumAddress.make("0x1111111111111111111111111111111111111111");
    await Promise.all(
      [
        { address },
        { ownerAddress: address },
        { salt: wallet.salt + 1n },
        { factoryVersion: "invalid" },
        { implementationVersion: "invalid" },
      ].map(async (change) => {
        const error = await Effect.runPromise(
          reconstructEvmAccount(
            { owner, wallet: { ...wallet, ...change } as typeof wallet },
            client,
          ).pipe(Effect.flip),
        );
        expect(["ACCOUNT_RECONSTRUCTION_FAILED", "ACCOUNT_ADDRESS_MISMATCH"]).toContain(error.code);
      }),
    );
    await expect(
      makeAlchemyModularV2Account(
        {
          ...({ accountMode: "factory", entryPointVersion: "0.7", salt: 0n } as const),
          owner: { ...owner, account: { ...owner.account, address } },
        },
        client,
      ),
    ).rejects.toThrow("public key");
    expect(sign).not.toHaveBeenCalled();
  });

  it("rejects unsupported networks and cross-chain signing", async () => {
    const { props, client, sign } = await setup();
    await expect(
      makeAlchemyModularV2Account(props, { ...client, chain: { ...sepolia, id: 31337 } }),
    ).rejects.toThrow("supported");
    const account = await makeAlchemyModularV2Account(props, client);
    await expect(
      account.signUserOperation({
        sender: account.address,
        callData: "0x",
        nonce: 0n,
        callGasLimit: 1n,
        verificationGasLimit: 1n,
        preVerificationGas: 1n,
        maxFeePerGas: 1n,
        maxPriorityFeePerGas: 1n,
        signature: "0x",
        chainId: 1,
      }),
    ).rejects.toThrow("chain");
    expect(sign).not.toHaveBeenCalled();
  });

  it("rejects substituted factory/init data, authorization and network in prepared operations", async () => {
    const { client, wallet, owner, sign } = await setup();
    const account = await Effect.runPromise(reconstructEvmAccount({ wallet, owner }, client));
    const calls = [
      {
        to: EthereumAddress.make("0x1111111111111111111111111111111111111111"),
        value: 0n,
        data: Hex.make("0x"),
      },
    ] as const;
    const operation = await Effect.runPromise(
      normalizeEvmUserOperation({
        sender: account.address,
        callData: await account.encodeCalls(calls),
        nonce: 1n << 64n,
        callGasLimit: 1n,
        verificationGasLimit: 1n,
        preVerificationGas: 1n,
        maxFeePerGas: 1n,
        maxPriorityFeePerGas: 1n,
        signature: "0x",
        ...(await account.getFactoryArgs()),
      }),
    );
    const input = {
      account: { wallet, owner },
      prepared: preparedExecutionFixture(operation, calls),
    };
    const reconstruct = makeReconstructPreparedAccount(() => ({ publicClient: client }));
    expect((await Effect.runPromise(reconstruct(input))).account.address).toBe(account.address);
    await Promise.all(
      [
        { factory: calls[0].to },
        { factoryData: Hex.make("0x") },
        { factory: undefined, factoryData: undefined },
        {
          authorization: {
            address: owner.account.address,
            chainId: sepolia.id,
            nonce: 0,
            r: `0x${"00".repeat(32)}`,
            s: `0x${"00".repeat(32)}`,
            yParity: 0,
          },
        },
      ].map(async (change) => {
        const corrupted = {
          ...input,
          prepared: { ...input.prepared, userOperation: { ...operation, ...change } },
        } as typeof input;
        expect(await Effect.runPromise(reconstruct(corrupted).pipe(Effect.flip))).toMatchObject({
          code: "SIGNING_FAILED",
        });
      }),
    );
    expect(
      await Effect.runPromise(
        reconstruct({ ...input, prepared: { ...input.prepared, chainId: "eip155:1" } }).pipe(
          Effect.flip,
        ),
      ),
    ).toMatchObject({ code: "SIGNING_FAILED" });
    expect(sign).not.toHaveBeenCalled();
  });
});
