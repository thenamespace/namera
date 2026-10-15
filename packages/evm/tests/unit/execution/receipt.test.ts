import { expect, it } from "@effect/vitest";
import { Effect, Option, Redacted } from "effect";

import { UserOperationHash } from "@namera-ai/protocol";
import { http } from "viem";
import { createBundlerClient } from "viem/account-abstraction";

import { getChainDataByCaip2 } from "../../../src/chains/helpers.js";
import { makeExecutionClients } from "../../../src/clients/execution.js";
import { makeGetEvmExecutionReceipt } from "../../../src/execution/receipt.js";

const hash = UserOperationHash.make(`0x${"11".repeat(32)}`);
const transactionHash = `0x${"22".repeat(32)}`;
const receipt = {
  userOpHash: hash,
  entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  sender: `0x${"33".repeat(20)}`,
  nonce: "0x7",
  actualGasCost: "0x64",
  actualGasUsed: "0x32",
  success: true,
  logs: [],
  receipt: {
    transactionHash,
    blockHash: `0x${"44".repeat(32)}`,
    blockNumber: "0x2a",
    transactionIndex: "0x0",
    cumulativeGasUsed: "0x32",
    gasUsed: "0x32",
    effectiveGasPrice: "0x2",
    logs: [],
    logsBloom: `0x${"00".repeat(256)}`,
    status: "0x1",
    type: "0x2",
  },
};

const lookup = (result: unknown, rpcError = false) => {
  const chain = getChainDataByCaip2("eip155:1");
  if (!chain) throw new Error("Missing Ethereum chain");
  const clients = makeExecutionClients({
    alchemyApiKey: Redacted.make("test"),
    alchemyBsoPolicyId: Redacted.make("test"),
  })(chain);
  const bundlerClient = createBundlerClient({
    chain: chain.chain,
    transport: http("https://bundler.invalid", {
      retryCount: 0,
      fetchFn: async (_url, init) => {
        const request = JSON.parse(String(init?.body));
        expect(request.method).toBe("eth_getUserOperationReceipt");
        expect(request.params).toEqual([hash]);
        return Response.json({
          jsonrpc: "2.0",
          id: request.id,
          ...(rpcError ? { error: result } : { result }),
        });
      },
    }),
  });
  return makeGetEvmExecutionReceipt(() => ({ ...clients, bundlerClient }))({
    chainId: "eip155:1",
    userOperationHash: hash,
  });
};

it.effect("keeps a missing receipt unknown rather than declaring failure", () =>
  Effect.gen(function* () {
    expect(yield* lookup(null)).toEqual(Option.none());
  }),
);

it.effect.each([true, false])("normalizes a mined receipt with success=%s", (success) =>
  Effect.gen(function* () {
    const result = Option.getOrThrow(
      yield* lookup({ ...receipt, success, reason: "execution reverted" }),
    );
    expect(result).toEqual({
      version: 1,
      namespace: "eip155",
      chainId: "eip155:1",
      userOperationHash: hash,
      transactionHash,
      blockHash: receipt.receipt.blockHash,
      blockNumber: 42n,
      sender: receipt.sender,
      nonce: 7n,
      entryPoint: receipt.entryPoint,
      paymaster: null,
      actualGasCost: 100n,
      actualGasUsed: 50n,
      success,
      reason: success ? null : "execution reverted",
    });
  }),
);

it.effect.each([
  {
    name: "missing transaction hash",
    result: { ...receipt, receipt: { ...receipt.receipt, transactionHash: undefined } },
  },
  {
    name: "null transaction hash",
    result: { ...receipt, receipt: { ...receipt.receipt, transactionHash: null } },
  },
  { name: "different operation hash", result: { ...receipt, userOpHash: `0x${"55".repeat(32)}` } },
  { name: "provider error", result: { code: -32000, message: "Unavailable" }, rpcError: true },
])("rejects $name as unusable evidence, not a failed transaction", ({ result, rpcError }) =>
  Effect.gen(function* () {
    expect(yield* lookup(result, rpcError).pipe(Effect.flip)).toMatchObject({
      _tag: "EvmExecutionError",
      code: "RECEIPT_LOOKUP_FAILED",
    });
  }),
);
