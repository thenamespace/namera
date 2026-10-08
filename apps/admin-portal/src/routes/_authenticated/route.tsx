import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { currentAdminAtom } from "@/atoms/auth";
import { prefetchQuery } from "@/atoms/prefetch";
import { AdminSidebar } from "@/components/sidebar";

export const Route = createFileRoute("/_authenticated")({
  loader: async ({ context, abortController }) => {
    context.atomRegistry.refresh(currentAdminAtom);
    const access = await prefetchQuery(
      context.atomRegistry,
      currentAdminAtom,
      abortController.signal,
    );
    if (access.status !== "authorized") throw redirect({ to: "/auth", replace: true });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AdminSidebar>
      <Outlet />
    </AdminSidebar>
  );
}
