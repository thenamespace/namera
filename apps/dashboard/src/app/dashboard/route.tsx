import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { SidebarProvider } from "@namera-ai/ui/components/ui/sidebar";

import { NotFound } from "@/components/misc";
import { Sidebar } from "@/components/sidebar";
import { getCurrentUser, listSmartAccounts } from "@/server/actions";

const DashboardLayout = () => {
  return (
    <div className="bg-sidebar">
      <SidebarProvider>
        <Sidebar />
        <div className="bg-background w-full m-1 border-border rounded-xl border-[0.5px]">
          <Outlet />
        </div>
      </SidebarProvider>
    </div>
  );
};

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw redirect({ to: "/auth" });
    }

    return currentUser;
  },
  component: DashboardLayout,
  loader: () => {
    const accounts = listSmartAccounts();
    return accounts;
  },
  notFoundComponent: () => <NotFound />,
});
