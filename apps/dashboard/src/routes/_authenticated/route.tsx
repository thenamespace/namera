import { Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";

import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { AppSidebar, SettingsSidebar } from "@/components";

export const Route = createFileRoute("/_authenticated")({
  loader: async ({ abortController, context, location }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );

    if (currentUser === null) {
      if (
        location.pathname.startsWith("/invitations/") ||
        location.pathname === "/oauth/authorize" ||
        location.pathname === "/cli/authorize"
      ) {
        throw redirect({
          to: "/auth",
          search: {
            returnTo:
              location.pathname === "/oauth/authorize" || location.pathname === "/cli/authorize"
                ? location.href
                : location.pathname,
          },
          replace: true,
        });
      }
      throw redirect({ to: "/auth", replace: true });
    }

    return currentUser;
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { pathname } = useLocation();
  if (
    pathname === "/workspace/new" ||
    pathname.startsWith("/invitations/") ||
    pathname === "/oauth/authorize" ||
    pathname === "/cli/authorize"
  ) {
    return <Outlet />;
  }

  const Sidebar = pathname.startsWith("/settings") ? SettingsSidebar : AppSidebar;

  return (
    <Sidebar>
      <Outlet />
    </Sidebar>
  );
}
