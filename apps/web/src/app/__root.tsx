import { createRootRoute, Outlet } from "@tanstack/react-router";

import { ProviderTree } from "@/providers";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ProviderTree>
      <Outlet />
    </ProviderTree>
  );
}
