import type { PropsWithChildren } from "react";

import { TooltipProvider } from "@repo/ui/components/ui/tooltip";

import { ThemeProvider } from "./theme";
import { Web3Provider } from "./web3";

export const ProviderTree = ({ children }: PropsWithChildren) => {
  return (
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        <Web3Provider>{children}</Web3Provider>
      </TooltipProvider>
    </ThemeProvider>
  );
};
