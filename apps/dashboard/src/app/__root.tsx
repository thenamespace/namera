/// <reference types="vite/client" />

import type { AtomRegistry } from "effect/unstable/reactivity";

import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router";

import { NotFound } from "@/components/misc";
import { ProviderTree } from "@/providers";
import { Button } from "@namera-ai/ui/components/ui/button";

// oxlint-disable-next-line import/no-unassigned-import
import "../styles/globals.css";
import { QueryClient } from "@tanstack/react-query";

import { atomRegistry } from "@/lib/atom";
import { AtomProvider } from "@/providers/atom";

function RootComponent() {
  return (
    <AtomProvider registry={atomRegistry}>
      <ProviderTree>
        <Outlet />
      </ProviderTree>
    </AtomProvider>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  atomRegistry: AtomRegistry.AtomRegistry;
}>()({
  component: RootComponent,
  errorComponent: () => <div>Some Error Occurred</div>,
  head: () => ({
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
        <Button className="mx-auto my-2 w-fit" render={<Link to="/" />}>
          Go to Home
        </Button>
      }
    />
  ),
});
