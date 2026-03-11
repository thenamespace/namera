import { createFileRoute, Outlet } from "@tanstack/react-router";

import { SidebarProvider } from "@namera-ai/ui/components/ui/sidebar";

import { Sidebar } from "@/components/sidebar";

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
  component: DashboardLayout,
});
