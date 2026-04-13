import type { ReactNode } from "react";

import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

import { getBaseSeo } from "@/lib/seo/base";
import { ProviderTree } from "@/providers";

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen" suppressHydrationWarning={true}>
        <div className="root">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <RootDocument>
      <ProviderTree>
        <Outlet />
      </ProviderTree>
    </RootDocument>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  head: () => {
    return getBaseSeo();
  },
});
