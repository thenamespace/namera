import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appDescription: "Agent Wallets",
  appIcon: "https://example.com/logo.svg",
  appName: "Agent Wallets",
  appUrl: "https://example.com",
  chains: [mainnet],
  projectId: "YOUR_PROJECT_ID",
  ssr: false,
  // TODO: Add RPC Transports
});

declare module "wagmi" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: needed for override
  interface Register {
    config: typeof wagmiConfig;
  }
}
