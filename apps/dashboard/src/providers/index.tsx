import type { PropsWithChildren } from "react";

import { Toaster } from "@namera-ai/ui/components/ui/sonner";
import { TooltipProvider } from "@namera-ai/ui/components/ui/tooltip";

import { HeadProvider } from "./unhead";
import { Web3Provider } from "./web3";

export const ProviderTree = ({ children }: PropsWithChildren) => {
  return (
    <HeadProvider>
      <Toaster position="bottom-right" />
      <TooltipProvider>
        <Web3Provider>{children}</Web3Provider>
      </TooltipProvider>
    </HeadProvider>
  );
};
