import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { AtomRegistry } from "effect/reactivity";

import { DashboardSeo } from "@/components/dashboard-seo";
import { DataLoading } from "@/components/data-loading";
import { RouterError, RouterNotFound } from "@/components/route-failure";
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
    defaultErrorComponent: RouterError,
    defaultNotFoundComponent: RouterNotFound,
    defaultPendingMinMs: 250,
    defaultPendingMs: 150,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    InnerWrap: ({ children }) => (
      <>
        <DashboardSeo />
        {children}
      </>
    ),
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
