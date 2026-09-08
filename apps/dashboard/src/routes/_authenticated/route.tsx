import { Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";

import { sessionAuthority } from "@/atoms/auth/authority";
import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { AppSidebar, SettingsSidebar } from "@/components";

import { SessionBoundary } from "./-components/session-boundary";

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
  const actor = Route.useLoaderData();
  return (
    <SessionBoundary key={sessionAuthority(actor)} actor={actor}>
      <AuthenticatedContent />
    </SessionBoundary>
  );
}

function AuthenticatedContent() {
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
