import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import type { RouterContext } from "@/router-context";

export const Route = createRootRouteWithContext<RouterContext>()({ component: Root });
function Root() {
  return (
    <div className="bg-background text-foreground min-h-screen font-inter">
      <Outlet />
    </div>
  );
}
