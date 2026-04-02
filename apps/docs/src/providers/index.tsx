import type { PropsWithChildren } from "react";

import { RootProvider } from "fumadocs-ui/provider/tanstack";

import { CustomSearchDialog } from "@/components";

import { PostHogProvider } from "./posthog";

export const ProviderTree = ({ children }: PropsWithChildren) => {
  return (
    <PostHogProvider>
      <RootProvider
        search={{
          // biome-ignore lint/style/useNamingConvention: safe
          SearchDialog: CustomSearchDialog,
        }}
      >
        {children}
      </RootProvider>
    </PostHogProvider>
  );
};
