import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { AtomRegistry } from "effect/unstable/reactivity";

import { DataLoading } from "@/components/data-loading";
import { routeTree } from "@/routeTree.gen";

function RouterPending() {
  return <DataLoading className="min-h-[50vh]" label="Loading page" />;
}

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
    defaultPendingComponent: RouterPending,
    defaultPendingMinMs: 250,
    defaultPendingMs: 150,
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
