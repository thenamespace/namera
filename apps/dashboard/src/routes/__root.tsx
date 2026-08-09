import { TanStackDevtools } from "@tanstack/react-devtools";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import type { RouterContext } from "@/router-context";

import "@/styles.css";

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
  return (
    <div className="bg-background text-foreground min-h-screen">
      <Outlet />
      <TanStackDevtools config={devtoolsConfig} plugins={devtoolsPlugins} />
    </div>
  );
}
