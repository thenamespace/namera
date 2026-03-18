import { type ChainWithMetadata, supportedChains } from "@namera-ai/schema";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { Effect } from "effect";
import { http } from "viem";

import { ClientEnv } from "@/layers/env/client";
import { clientRuntime } from "@/runtime/client";

const chains = Object.values(supportedChains) as [
  ChainWithMetadata,
  ...ChainWithMetadata[],
];

const transports = clientRuntime.runSync(
  Effect.gen(function* () {
    const env = yield* ClientEnv;
    const transports = chains
      .map((c) => {
        return { [c.id]: http(`${env.backendUrl.toString()}rpc/${c.id}`) };
      })
      .reduce((acc, curr) => Object.assign(acc, curr), {});

    return transports;
  }),
);

const projectId = clientRuntime.runSync(
  Effect.gen(function* () {
    const env = yield* ClientEnv;
    return env.reownProjectId;
  }),
);

export const wagmiConfig = getDefaultConfig({
  appDescription: "",
  appIcon: "https://namera.ai/logo.svg",
  appName: "Namera",
  appUrl: "https://namera.ai",
  chains,
  projectId,
  ssr: true,
  transports,
});

declare module "wagmi" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: needed for override
  interface Register {
    config: typeof wagmiConfig;
  }
}
