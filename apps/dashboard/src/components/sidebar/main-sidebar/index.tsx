import type { PropsWithChildren } from "react";

import { Sidebar } from "@namera-ai/ui";

import { DashboardShellContext } from "@/components/page/route-state";

import { ResponsiveSidebar } from "../responsive-sidebar";
import { SidebarGroup } from "../sidebar-group";
import { adminGroupItems } from "./admin";
import { coreGroupItems } from "./core";
import { SidebarHeader } from "./header";
import { primaryGroupItems } from "./primary";

export const AppSidebar = ({ children }: PropsWithChildren) => {
  return (
    <Sidebar.Provider variant="inset" collapsible="offcanvas">
      <ResponsiveSidebar>
        <SidebarHeader />
        <Sidebar.Content>
          <SidebarGroup {...primaryGroupItems} />
          <SidebarGroup {...coreGroupItems} />
          <SidebarGroup {...adminGroupItems} />
        </Sidebar.Content>
      </ResponsiveSidebar>
      <DashboardShellContext.Provider value={true}>{children}</DashboardShellContext.Provider>
    </Sidebar.Provider>
  );
};
