import type { PropsWithChildren } from "react";

import { Sidebar } from "@namera-ai/ui";

import { SidebarGroup } from "../sidebar-group";
import { SidebarMain } from "../sidebar-main";
import { adminGroupItems } from "./admin";
import { agentsGroupItems } from "./agents";
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
          <SidebarGroup {...agentsGroupItems} />
          <SidebarGroup {...adminGroupItems} />
        </Sidebar.Content>
      </Sidebar>
      <SidebarMain>{children}</SidebarMain>
    </Sidebar.Provider>
  );
};
