import type { PropsWithChildren } from "react";

import { Outlet, createRootRouteWithContext, useLocation } from "@tanstack/react-router";

import { Toast } from "@namera-ai/ui";

import "@/styles.css";
import { AppSidebar, SettingsSidebar } from "@/components";
import type { RouterContext } from "@/router-context";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  const { pathname } = useLocation();

  const Sidebar = (() => {
    if (pathname.startsWith("/auth")) return ({ children }: PropsWithChildren) => <>{children}</>;
    if (pathname.startsWith("/settings")) return SettingsSidebar;
    return AppSidebar;
  })();

  return (
    <div className="bg-[#010102] text-foreground min-h-screen font-inter">
      <Sidebar>
        <Outlet />
      </Sidebar>
      <Toast.Provider placement="bottom end" />
    </div>
  );
}
