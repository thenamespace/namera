import { createSessionKeyClient } from "@namera-ai/core";
import { Effect, Redacted } from "effect";
import { createPublicClient, http } from "viem";
import { createPaymasterClient } from "viem/account-abstraction";

import type { CurrentMcpContextShape } from "@/layers";

import { getChain, type SupportedChain } from "../common/index";
import { McpConfig } from "../config";

export const createKernelClient = (
  sessionKey: CurrentMcpContextShape["sessionKeys"][number],
  chain: SupportedChain,
) =>
  Effect.gen(function* () {
    const config = yield* McpConfig;

    const c = getChain(chain);

    const rpcUrl = yield* config.getRpcUrl(chain);
    const bundlerUrl = yield* config.getBundlerUrl(chain);
    const paymasterUrl = yield* config.getPaymasterUrl(chain);

    const publicClient = createPublicClient({
      chain: c,
      transport: http(rpcUrl ? Redacted.value(rpcUrl) : undefined),
    });

    const paymasterClient = paymasterUrl
      ? createPaymasterClient({
          transport: http(Redacted.value(paymasterUrl)),
        })
      : undefined;

    const client = yield* Effect.promise(() =>
      createSessionKeyClient({
        bundlerTransport: http(
          bundlerUrl ? Redacted.value(bundlerUrl) : undefined,
        ),
        chain: c,
        client: publicClient,
        paymaster: paymasterClient,
        serializedAccount: sessionKey.serializedAccount,
        sessionKeySigner: sessionKey.signer,
      }),
    );

    return client;
  });
