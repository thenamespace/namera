import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";

import { env } from "@/env";
import { type ChainWithMetadata, supportedChains } from "@namera-ai/schema";

const chains = Object.values(supportedChains) as [
  ChainWithMetadata,
  ...ChainWithMetadata[],
];

const transports = chains
  .map((c) => {
    return {
      [c.id]: http(new URL(`/rpc/${c.id}`, env.backendUrl).toString()),
    };
  })
  .reduce((acc, curr) => Object.assign(acc, curr), {});

const projectId = env.reownProjectId;

export const wagmiConfig = getDefaultConfig({
  appDescription: "",
  appIcon: "https://namera.ai/logo.svg",
  appName: "Namera",
  appUrl: "https://dashboard.namera.ai",
  chains,
  projectId,
  ssr: false,
  transports,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
