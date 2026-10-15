import { expect, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";

import { EthereumAddress, Hex } from "@namera-ai/protocol";
import { http } from "viem";
import { createBundlerClient } from "viem/account-abstraction";

import { getChainDataByCaip2 } from "../../../src/chains/helpers.js";
import { makeExecutionClients } from "../../../src/clients/execution.js";
import { completeSignedEvmExecution } from "../../../src/execution/signed-operation.js";
import { makeSubmitEvmExecution } from "../../../src/execution/submit.js";
import { preparedExecutionFixture } from "../../fixtures/prepared-execution.js";

it.effect.each([
  ...[
    -32602,
    -32500,
    -32501,
    -32502,
    -32503,
    -32504,
    -32505,
    -32507,
    -32508,
    "insufficient-funds",
  ].map((code) => ({ code, expected: "SUBMISSION_REJECTED" })),
  ...[-32603, -32000, -32005, 429, "timeout", "http-unavailable"].map((code) => ({
    code,
    expected: "SUBMISSION_UNKNOWN",
  })),
])("classifies $code as $expected without rebroadcasting", ({ code, expected }) =>
  Effect.gen(function* () {
    const chain = getChainDataByCaip2("eip155:11155111");
    if (chain === undefined) throw new Error("Missing test chain");
    const signed = yield* completeSignedEvmExecution(
      preparedExecutionFixture(
        {
          sender: EthereumAddress.make("0x1111111111111111111111111111111111111111"),
          nonce: 0n,
          callData: Hex.make("0x"),
          signature: Hex.make("0x1234"),
          callGasLimit: 100_000n,
          verificationGasLimit: 100_000n,
          preVerificationGas: 21_000n,
          maxFeePerGas: 1n,
          maxPriorityFeePerGas: 1n,
        },
        [],
      ),
      chain,
      "0x1234",
    );
    const clients = makeExecutionClients({
      alchemyApiKey: Redacted.make("test"),
      alchemyBsoPolicyId: Redacted.make("test"),
    })(chain);

    let requests = 0;
    const bundler = createBundlerClient({
      chain: chain.chain,
      transport: http("https://bundler.invalid", {
        retryCount: 0,
        fetchFn: async () => {
          requests++;
          if (code === "timeout") throw new Error("Connection closed before response");
          if (code === "http-unavailable") return new Response(null, { status: 503 });
          return Response.json({
            jsonrpc: "2.0",
            id: 1,
            error: {
              code: code === "insufficient-funds" ? -32000 : code,
              message:
                code === "insufficient-funds"
                  ? "precheck failed: sender balance and deposit together is 0 but must be at least 91995114471845 to pay for this operation"
                  : "Provider failure",
            },
          });
        },
      }),
    });
    const submit = makeSubmitEvmExecution(() => ({
      ...clients,
      getSubmissionClient: () => bundler,
    }));
    const error = yield* submit({ signed }).pipe(Effect.flip);
    expect(error).toMatchObject({
      _tag: "EvmExecutionError",
      code: expected,
    });
    expect(requests).toBe(1);
  }),
);
