import { Effect, Result } from "effect";

import { EthereumAddress, Hex } from "@namera-ai/protocol";
import { createPublicClient, custom, encodeAbiParameters } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";

import { makeCheckEvmFunding } from "../../../src/execution/funding.js";
import { preparedExecutionFixture } from "../../fixtures/prepared-execution.js";

const prepared = preparedExecutionFixture(
  {
    sender: EthereumAddress.make("0x1111111111111111111111111111111111111111"),
    nonce: 0n,
    callData: Hex.make("0x"),
    signature: Hex.make("0x"),
    callGasLimit: 10n,
    verificationGasLimit: 10n,
    preVerificationGas: 10n,
    maxFeePerGas: 2n,
    maxPriorityFeePerGas: 1n,
  },
  [],
);

describe("owner transaction account funding", () => {
  for (const [balance, deposit, sponsored, funded] of [
    [0n, 1000n, false, false],
    [100n, 60n, false, true],
    [100n, 59n, false, false],
    [99n, 1000n, true, false],
    [100n, 0n, true, true],
  ] as const) {
    it(`separates transfer value from gas: ${balance}/${deposit}/${sponsored}`, async () => {
      const publicClient = createPublicClient({
        chain: mainnet,
        transport: custom({
          request: async ({ method }) => {
            if (method === "eth_getBalance") return `0x${balance.toString(16)}`;
            if (method === "eth_call") return encodeAbiParameters([{ type: "uint256" }], [deposit]);
            throw new Error("Unexpected method");
          },
        }),
      });
      let selectedChain: number | undefined;
      const checkFunding = makeCheckEvmFunding((chain) => {
        selectedChain = chain.chain.id;
        return { publicClient };
      });
      const result = await Effect.runPromise(
        checkFunding({
          ...prepared,
          chainId: "eip155:8453",
          sponsorship: sponsored ? "alchemy-bso" : "none",
          context: {
            ...prepared.context,
            calls: [{ to: prepared.userOperation.sender, value: 100n, data: Hex.make("0x") }],
          },
        }).pipe(Effect.result),
      );
      expect(Result.isSuccess(result)).toBe(funded);
      expect(selectedChain).toBe(8453);
    });
  }

  for (const [balance, deposit, funded] of [
    [0n, 0n, false],
    [59n, 0n, false],
    [60n, 0n, true],
    [0n, 60n, true],
    [30n, 30n, true],
  ] as const) {
    it(`checks native balance ${balance} plus deposit ${deposit}`, async () => {
      const publicClient = createPublicClient({
        chain: mainnet,
        transport: custom({
          request: async ({ method }) => {
            if (method === "eth_getBalance") return `0x${balance.toString(16)}`;
            if (method === "eth_call") return encodeAbiParameters([{ type: "uint256" }], [deposit]);
            throw new Error("Unexpected method");
          },
        }),
      });
      const checkFunding = makeCheckEvmFunding(() => ({ publicClient }));
      const result = await Effect.runPromise(checkFunding(prepared).pipe(Effect.result));
      expect(Result.isSuccess(result)).toBe(funded);
      if (Result.isFailure(result)) expect(result.failure.code).toBe("INSUFFICIENT_FUNDS");
    });
  }
  it("does not require account ETH for sponsored operations and fails closed on RPC errors", async () => {
    const publicClient = createPublicClient({
      chain: mainnet,
      transport: custom(
        {
          request: async () => {
            throw new Error("offline");
          },
        },
        { retryCount: 0 },
      ),
    });
    const checkFunding = makeCheckEvmFunding(() => ({ publicClient }));
    await Effect.runPromise(checkFunding({ ...prepared, sponsorship: "alchemy-bso" }));
    const result = await Effect.runPromise(checkFunding(prepared).pipe(Effect.flip));
    expect(result.code).toBe("PREPARATION_FAILED");
  });
});
