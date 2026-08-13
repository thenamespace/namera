import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";

import { Toast } from "@namera-ai/ui";

import "@/styles.css";
import type { RouterContext } from "@/router-context";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="bg-[#010102] text-foreground min-h-screen font-inter">
      <Outlet />
      <Toast.Provider placement="bottom end" />
    </div>
  );
}
