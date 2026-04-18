import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getCurrentUser } from "@/actions";
import { listSmartAccounts } from "@/actions/core";
import { NotFound } from "@/components/misc";
import { Sidebar } from "@/components/sidebar";
import { SidebarProvider } from "@namera-ai/ui/components/ui/sidebar";

const DashboardLayout = () => {
  return (
    <div className="bg-sidebar">
      <SidebarProvider>
        <Sidebar />
        <div className="border-border m-1 w-full rounded-xl border-[0.5px] bg-[#0F0F10]">
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
    const res = listSmartAccounts();
    return res;
  },
  notFoundComponent: () => <NotFound />,
});
