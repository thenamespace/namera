// src/router.tsx
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./route-tree.gen";

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
  });

  return router;
}

declare module "@tanstack/react-router" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: safe
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
