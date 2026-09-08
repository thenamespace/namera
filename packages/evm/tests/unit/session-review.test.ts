import { Effect, Schema } from "effect";

import { EthereumAddress } from "@namera-ai/protocol";
import { EvmSessionAuthorization } from "@namera-ai/protocol/evm";
import * as P256 from "ox/P256";
import * as PublicKey from "ox/PublicKey";
import { createPublicClient, custom, encodeAbiParameters, parseAbiParameters } from "viem";
import { sepolia } from "viem/chains";
import { describe, expect, it } from "vitest";

import {
  reviewEvmSessionOperation,
  type ReviewEvmSessionOperationInput,
} from "../../src/sessions/review.js";

const walletAddress = EthereumAddress.make("0x1111111111111111111111111111111111111111");
const input: ReviewEvmSessionOperationInput = {
  wallet: {
    version: 1,
    implementation: "alchemy-modular-v2",
    modularAccountVersion: "2.0.0",
    validatorType: "webauthn_p256",
    entryPointVersion: "0.7",
    salt: 0n,
    entityId: 0,
    address: walletAddress,
  },
  ownerPublicKey: PublicKey.toHex(P256.getPublicKey({ privateKey: `0x${"01".repeat(32)}` })),
  chainId: "eip155:11155111",
  kind: "install",
  authorization: Schema.decodeUnknownSync(EvmSessionAuthorization)({
    version: 1,
    signerAddress: "0x2222222222222222222222222222222222222222",
    entityId: 7,
    validAfter: 0,
    validUntil: 2000000000,
    permissions: [{ type: "root" }],
  }),
};

// Substitute only RPC reads; account construction and permission encoding are real.
const client = createPublicClient({
  chain: sepolia,
  transport: custom({
    request: async ({ method }) => {
      if (method === "eth_call") return encodeAbiParameters([{ type: "address" }], [walletAddress]);
      if (method === "eth_getCode") return "0x";
      throw new Error(`Unexpected RPC method: ${method}`);
    },
  }),
});

describe("browser session operation review", () => {
  it("reviews install and removal after the wallet is deployed", async () => {
    const deployedClient = createPublicClient({
      chain: sepolia,
      transport: custom({
        request: async ({ method, params }) => {
          if (method === "eth_call" && params[0].to.toLowerCase() === walletAddress)
            return encodeAbiParameters(
              parseAbiParameters("(uint8, bytes25[], bytes25[], bytes4[])"),
              [[0, [], [], []]],
            );
          if (method === "eth_call")
            return encodeAbiParameters([{ type: "address" }], [walletAddress]);
          if (method === "eth_getCode") return "0x6000";
          throw new Error(`Unexpected RPC method: ${method}`);
        },
      }),
    });
    await Promise.all(
      (["install", "uninstall"] as const).map(async (kind) => {
        const [reviewed, counterfactual] = await Promise.all([
          Effect.runPromise(reviewEvmSessionOperation({ ...input, kind }, deployedClient)),
          Effect.runPromise(reviewEvmSessionOperation({ ...input, kind }, client)),
        ]);
        expect(reviewed).toEqual(counterfactual);
      }),
    );
  });

  it("compiles stable install/removal calls with public owner material only", async () => {
    const first = await Effect.runPromise(reviewEvmSessionOperation(input, client));
    const second = await Effect.runPromise(reviewEvmSessionOperation(input, client));
    const uninstall = await Effect.runPromise(
      reviewEvmSessionOperation({ ...input, kind: "uninstall" }, client),
    );
    expect(first).toEqual(second);
    expect(first.walletAddress.toLowerCase()).toBe(walletAddress);
    expect(first.ownerEntityId).toBe(0);
    expect(first.factoryData.length).toBeGreaterThan(10);
    expect(uninstall.factoryData).toBe(first.factoryData);
    expect(uninstall.callData).not.toBe(first.callData);
    const signatures = await Effect.runPromise(
      reviewEvmSessionOperation(
        {
          ...input,
          authorization: { ...input.authorization, allowSignatures: true },
        },
        client,
      ),
    );
    expect(signatures.callData).not.toBe(first.callData);
  });

  it("rejects a wallet address that does not reconstruct from its owner", async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        reviewEvmSessionOperation(
          {
            ...input,
            wallet: { ...input.wallet, address: input.authorization.signerAddress },
          },
          client,
        ),
      ),
    );
    expect(error).toMatchObject({ code: "ACCOUNT_ADDRESS_MISMATCH" });
  });

  it("rejects a client for another chain before compiling an approval", async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        reviewEvmSessionOperation(
          {
            ...input,
            chainId: "eip155:1",
          },
          client,
        ),
      ),
    );
    expect(error).toMatchObject({ code: "ACCOUNT_RECONSTRUCTION_FAILED" });
  });
});
