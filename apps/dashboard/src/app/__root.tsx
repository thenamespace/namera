/// <reference types="vite/client" />

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

function RootComponent() {
  return (
    <ProviderTree>
      <Outlet />
    </ProviderTree>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
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
