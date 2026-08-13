import { Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";

import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { AppSidebar, SettingsSidebar } from "@/components";

export const Route = createFileRoute("/_authenticated")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );

    if (currentUser === null) {
      throw redirect({ to: "/auth", replace: true });
    }

    return currentUser;
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { pathname } = useLocation();
  const Sidebar = pathname.startsWith("/settings") ? SettingsSidebar : AppSidebar;

  return (
    <Sidebar>
      <Outlet />
    </Sidebar>
  );
}
