import { createRouter } from "@tanstack/react-router";

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { AtomRegistry } from "effect/reactivity";

import { RouteError, RouteLoading, RouteNotFound } from "@/components/route-states";
import { routeTree } from "@/routeTree.gen";

export function getRouter() {
  const atomRegistry = AtomRegistry.make({ scheduleTask, defaultIdleTTL: 30_000 });
  return createRouter({
    routeTree,
    context: { atomRegistry },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: RouteLoading,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
    Wrap: ({ children }) => (
      <RegistryContext.Provider value={atomRegistry}>{children}</RegistryContext.Provider>
    ),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
