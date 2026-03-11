import type { PropsWithChildren } from "react";

import { RootProvider } from "fumadocs-ui/provider/tanstack";

import { CustomSearchDialog } from "@/components";

export const ProviderTree = ({ children }: PropsWithChildren) => {
  return (
    <RootProvider
      search={{
        // biome-ignore lint/style/useNamingConvention: safe
        SearchDialog: CustomSearchDialog,
      }}
    >
      {children}
    </RootProvider>
  );
};
