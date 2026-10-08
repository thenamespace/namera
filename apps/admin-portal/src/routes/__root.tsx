import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import { Toast } from "@namera-ai/ui";

import type { RouterContext } from "@/router-context";

export const Route = createRootRouteWithContext<RouterContext>()({ component: Root });
function Root() {
  return (
    <div className="bg-app-canvas text-foreground min-h-screen font-inter">
      <Outlet />
      <Toast.Provider placement="bottom end" maxVisibleToasts={3} />
    </div>
  );
}
