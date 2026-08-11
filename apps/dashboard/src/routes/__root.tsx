import type { PropsWithChildren } from "react";

import { TanStackDevtools } from "@tanstack/react-devtools";
import { Outlet, createRootRouteWithContext, useLocation } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import "@/styles.css";
import { AppSidebar, SettingsSidebar } from "@/components";
import type { RouterContext } from "@/router-context";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

const devtoolsConfig = {
  position: "bottom-right",
} as const;

const devtoolsPlugins = [
  {
    name: "TanStack Router",
    render: <TanStackRouterDevtoolsPanel />,
  },
];

function RootComponent() {
  const { pathname } = useLocation();

  const Sidebar = (() => {
    if (pathname.startsWith("/auth")) return ({ children }: PropsWithChildren) => <>{children}</>;
    if (pathname.startsWith("/settings")) return SettingsSidebar;
    return AppSidebar;
  })();

  return (
    <div className="bg-background text-foreground min-h-screen font-inter">
      <Sidebar>
        <Outlet />
      </Sidebar>
      <TanStackDevtools config={devtoolsConfig} plugins={devtoolsPlugins} />
    </div>
  );
}
