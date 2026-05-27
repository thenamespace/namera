import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";

import { authMiddleware } from "@/actions/middlewares";
import { NotFound } from "@/components/misc";
import { SettingsSidebar, Sidebar } from "@/components/sidebar";
import { SidebarProvider } from "@namera-ai/ui/components/ui/sidebar";

const DashboardLayout = () => {
  const { pathname } = useLocation();
  return (
    <div className="bg-sidebar">
      <SidebarProvider>
        {pathname.startsWith("/dashboard/settings") ? (
          <SettingsSidebar />
        ) : (
          <Sidebar />
        )}
        <div className="border-border m-2 w-full rounded-xl border bg-[#0F0F10]">
          <Outlet />
        </div>
      </SidebarProvider>
    </div>
  );
};

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ context }) => {
    return await authMiddleware(context.queryClient);
  },
  component: DashboardLayout,
  loader: () => {
    // const res = listSmartAccounts();
    // return res;
  },
  notFoundComponent: () => <NotFound />,
});
