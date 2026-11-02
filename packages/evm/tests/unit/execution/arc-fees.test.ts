import { Redacted } from "effect";

import { createClient, custom } from "viem";
import { expect, it } from "vitest";

import { chains } from "../../../src/chains/data.js";
import { makeExecutionClients } from "../../../src/clients/execution.js";

const networks = ["arc-mainnet", "arc-testnet", "ethereum-mainnet"] as const;
const modes = ["none", "alchemy-bso"] as const;

it.each(networks.flatMap((name) => modes.map((sponsorship) => ({ name, sponsorship }))))(
  "estimates $sponsorship fees on $name with the appropriate native fee floor",
  async ({ name, sponsorship }) => {
    const clients = makeExecutionClients({
      alchemyApiKey: Redacted.make("test"),
      alchemyBsoPolicyId: Redacted.make("test"),
    })(chains[name]);
    const provider = createClient({
      transport: custom({
        request: async ({ method }) => {
          expect(method).toBe("rundler_getUserOperationGasPrice");
          return { suggested: { maxFeePerGas: "0x1", maxPriorityFeePerGas: "0x0" } };
        },
      }),
    });
    const estimate = clients.getSubmissionClient(sponsorship).userOperation?.estimateFeesPerGas;
    if (!estimate) throw new Error("Missing fee estimator");

    expect(
      await estimate({ account: undefined, bundlerClient: provider, userOperation: {} }),
    ).toEqual({
      maxFeePerGas: name === "ethereum-mainnet" ? 1n : 20_000_000_000n,
      maxPriorityFeePerGas: 0n,
    });
  },
);
