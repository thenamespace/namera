import type { PropsWithChildren } from "react";

import { TooltipProvider } from "@repo/ui/components/ui/tooltip";

import { Web3Provider } from "./web3";

export const ProviderTree = ({ children }: PropsWithChildren) => {
  return (
    <TooltipProvider>
      <Web3Provider>{children}</Web3Provider>
    </TooltipProvider>
  );
};
