import type { ReactNode } from "react";

import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

import rainbowkitCss from "@rainbow-me/rainbowkit/styles.css?url";
import appCss from "@repo/ui/globals.css?url";

import { ProviderTree } from "@/providers";

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
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
  head: () => ({
    links: [
      { href: appCss, rel: "stylesheet" },
      { href: rainbowkitCss, rel: "stylesheet" },
    ],
    meta: [
      {
        charSet: "utf-8",
      },
      {
        content: "width=device-width, initial-scale=1",
        name: "viewport",
      },
      {
        title: "TanStack Start Starter",
      },
    ],
  }),
});
