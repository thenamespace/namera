import { expect, it } from "@effect/vitest";
import { Effect, Redacted, Result } from "effect";

import { UserOperationHash } from "@namera-ai/protocol";
import { http } from "viem";
import { createBundlerClient } from "viem/account-abstraction";

import { getChainDataByCaip2 } from "../../../src/chains/helpers.js";
import { makeExecutionClients } from "../../../src/clients/execution.js";
import { makeGetEvmUserOperationStatus } from "../../../src/execution/receipt.js";

const hash = UserOperationHash.make(`0x${"11".repeat(32)}`);
const transactionHash = `0x${"22".repeat(32)}`;

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

it.effect("keeps observed operations pending receipt verification", () =>
  Effect.gen(function* () {
    for (const tx of [null, transactionHash]) {
      expect(yield* lookup({ transactionHash: tx })).toEqual({
        status: "submitted",
        transactionHash: tx,
      });
    }
  }),
);

it.effect("does not turn RPC failures or malformed responses into absence or rejection", () =>
  Effect.gen(function* () {
    for (const effect of [
      lookup({ code: -32601, message: "Method not found" }, true),
      lookup({ code: -32000, message: "Provider unavailable" }, true),
      lookup({ transactionHash: "invalid" }),
      lookup({}),
    ]) {
      const result = yield* effect.pipe(Effect.result);
      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result))
        expect(result.failure).toMatchObject({ code: "RECEIPT_LOOKUP_FAILED" });
    }
  }),
);
