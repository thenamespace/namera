/// <reference types="vite/client" />
import type { ReactNode } from "react";

import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";

import { Button } from "@namera-ai/ui/components/ui/button";

import { NotFound } from "@/components/misc";
import { ProviderTree } from "@/providers";
import appCss from "@/styles/globals.css?url";

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning={true}>
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
  errorComponent: () => <div>Some Error Occurred</div>,
  head: () => ({
    links: [{ href: appCss, rel: "stylesheet" }],
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
  notFoundComponent: () => (
    <NotFound
      extraContent={
        <Button className="w-fit mx-auto my-2" render={<Link to="/" />}>
          Go to Home
        </Button>
      }
    />
  ),
});
