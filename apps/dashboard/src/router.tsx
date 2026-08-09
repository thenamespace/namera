import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { AtomRegistry } from "effect/unstable/reactivity";

import { routeTree } from "@/routeTree.gen";

export function getRouter() {
  const atomRegistry = AtomRegistry.make({
    scheduleTask,
    defaultIdleTTL: 30_000,
  });
  const router = createTanStackRouter({
    routeTree,
    context: {
      atomRegistry,
    },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    Wrap: ({ children }) => (
      <RegistryContext.Provider value={atomRegistry}>{children}</RegistryContext.Provider>
    ),
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
