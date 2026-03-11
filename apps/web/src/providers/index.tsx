import type { PropsWithChildren } from "react";

import { TooltipProvider } from "@namera-ai/ui/components/ui/tooltip";
import { RootProvider } from "fumadocs-ui/provider/tanstack";

import { CustomSearchDialog } from "@/lib/fumadocs/search";

import { Web3Provider } from "./web3";

export const ProviderTree = ({ children }: PropsWithChildren) => {
  return (
    <RootProvider
      search={{
        // biome-ignore lint/style/useNamingConvention: safe
        SearchDialog: CustomSearchDialog,
      }}
    >
      <TooltipProvider>
        <Web3Provider>{children}</Web3Provider>
      </TooltipProvider>
    </RootProvider>
  );
};
