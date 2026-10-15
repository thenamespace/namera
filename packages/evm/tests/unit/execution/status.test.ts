import { expect, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";

import { UserOperationHash } from "@namera-ai/protocol";
import { http } from "viem";
import { createBundlerClient } from "viem/account-abstraction";

import { getChainDataByCaip2 } from "../../../src/chains/helpers.js";
import { makeExecutionClients } from "../../../src/clients/execution.js";
import { makeGetEvmUserOperationStatus } from "../../../src/execution/receipt.js";

const hash = UserOperationHash.make(`0x${"11".repeat(32)}`);
const transactionHash = `0x${"22".repeat(32)}`;
const pendingOperation = {
  entryPoint: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  userOperation: { sender: `0x${"33".repeat(20)}`, nonce: "0x0" },
};

const lookup = (result: unknown, error = false) => {
  const chain = getChainDataByCaip2("eip155:1");
  if (!chain) throw new Error("Missing Ethereum chain");
  const clients = makeExecutionClients({
    alchemyApiKey: Redacted.make("test"),
    alchemyBsoPolicyId: Redacted.make("test"),
  })(chain);
  const statusClient = createBundlerClient({
    chain: chain.chain,
    transport: http("https://bundler.invalid", {
      retryCount: 0,
      fetchFn: async (_url, init) => {
        const request = JSON.parse(String(init?.body));
        expect(request.method).toBe("eth_getUserOperationByHash");
        expect(request.params).toEqual([hash]);
        return Response.json({
          jsonrpc: "2.0",
          id: request.id,
          ...(error ? { error: result } : { result }),
        });
      },
    }),
  });
  return makeGetEvmUserOperationStatus(() => ({ ...clients, statusClient }))({
    chainId: "eip155:1",
    userOperationHash: hash,
  });
};

it.effect("treats a null Alchemy lookup as unobserved, not rejected or failed", () =>
  Effect.gen(function* () {
    expect(yield* lookup(null)).toEqual({ status: "not_found", transactionHash: null });
  }),
);

it.effect.each([
  { name: "absent transaction hash", transactionHash: undefined },
  { name: "null transaction hash", transactionHash: null },
  { name: "observed transaction hash", transactionHash },
])("keeps $name pending receipt verification", ({ transactionHash: tx }) =>
  Effect.gen(function* () {
    expect(
      yield* lookup({
        ...pendingOperation,
        ...(tx === undefined ? {} : { transactionHash: tx }),
      }),
    ).toEqual({
      status: "submitted",
      transactionHash: tx ?? null,
    });
  }),
);

it.effect.each([
  {
    name: "unsupported RPC method",
    response: { code: -32601, message: "Method not found" },
    rpcError: true,
  },
  {
    name: "provider outage",
    response: { code: -32000, message: "Provider unavailable" },
    rpcError: true,
  },
  {
    name: "invalid transaction hash",
    response: { ...pendingOperation, transactionHash: "invalid" },
  },
  { name: "missing operation", response: { ...pendingOperation, userOperation: null } },
  { name: "invalid EntryPoint", response: { ...pendingOperation, entryPoint: "invalid" } },
  { name: "empty response", response: {} },
])("does not interpret $name as absence or rejection", ({ response, rpcError }) =>
  Effect.gen(function* () {
    const error = yield* lookup(response, rpcError).pipe(Effect.flip);
    expect(error).toMatchObject({ _tag: "EvmExecutionError", code: "RECEIPT_LOOKUP_FAILED" });
  }),
);
