import type { PropsWithChildren } from "react";

import { TooltipProvider } from "@repo/ui/components/ui/tooltip";
import { RootProvider } from "fumadocs-ui/provider/tanstack";

import { Web3Provider } from "./web3";

export const ProviderTree = ({ children }: PropsWithChildren) => {
  return (
    <RootProvider>
      <TooltipProvider>
        <Web3Provider>{children}</Web3Provider>
      </TooltipProvider>
    </RootProvider>
  );
};
