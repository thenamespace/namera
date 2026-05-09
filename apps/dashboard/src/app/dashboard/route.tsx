import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";

// import { getCurrentUser } from "@/actions";
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
  beforeLoad: async () => {
    // const currentUser = await getCurrentUser();
    // if (!currentUser) {
    //   throw redirect({ to: "/auth" });
    // }
    // return currentUser;
  },
  component: DashboardLayout,
  loader: () => {
    // const res = listSmartAccounts();
    // return res;
  },
  notFoundComponent: () => <NotFound />,
});
