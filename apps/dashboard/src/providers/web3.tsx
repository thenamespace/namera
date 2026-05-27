import type { PropsWithChildren } from "react";

import {
  darkTheme,
  lightTheme,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "@/lib/wagmi";

export const Web3Provider = ({ children }: PropsWithChildren) => {
  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider
        modalSize="compact"
        theme={{
          darkMode: darkTheme(),
          lightMode: lightTheme(),
        }}
      >
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
};
