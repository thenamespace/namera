import type { PropsWithChildren } from "react";

import { TooltipProvider } from "@namera-ai/ui/components/ui/tooltip";

import { HeadProvider } from "./unhead";
import { Web3Provider } from "./web3";

export const ProviderTree = ({ children }: PropsWithChildren) => {
  return (
    <HeadProvider>
      <TooltipProvider>
        <Web3Provider>{children}</Web3Provider>
      </TooltipProvider>
    </HeadProvider>
  );
};
