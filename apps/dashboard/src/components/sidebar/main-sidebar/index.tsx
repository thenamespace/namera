import type { PropsWithChildren } from "react";

import { Sidebar } from "@namera-ai/ui";

import { DashboardShellContext } from "@/components/page/route-state";

import { SidebarGroup } from "../sidebar-group";
import { adminGroupItems } from "./admin";
import { coreGroupItems } from "./core";
import { SidebarHeader } from "./header";
import { primaryGroupItems } from "./primary";

export const AppSidebar = ({ children }: PropsWithChildren) => {
  return (
    <Sidebar.Provider variant="inset" collapsible="offcanvas">
      <Sidebar>
        <SidebarHeader />
        <Sidebar.Content>
          <SidebarGroup {...primaryGroupItems} />
          <SidebarGroup {...coreGroupItems} />
          <SidebarGroup {...adminGroupItems} />
        </Sidebar.Content>
      </Sidebar>
      <DashboardShellContext.Provider value={true}>{children}</DashboardShellContext.Provider>
    </Sidebar.Provider>
  );
};
