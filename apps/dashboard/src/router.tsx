import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { atomRegistry } from "@/lib/atom";

import { routeTree } from "./route-tree.gen";

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    context: {
      atomRegistry,
    },
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
