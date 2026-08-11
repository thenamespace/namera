import type { PropsWithChildren } from "react";

import { Sidebar } from "@namera-ai/ui";

import { SidebarGroup } from "../sidebar-group";
import { SidebarHeader } from "./header";
import { primaryGroupItems } from "./primary";
import { workspaceGroupItems } from "./workspace";

export const SettingsSidebar = ({ children }: PropsWithChildren) => {
  return (
    <Sidebar.Provider variant="inset" collapsible="offcanvas">
      <Sidebar>
        <SidebarHeader />
        <Sidebar.Content>
          <SidebarGroup {...primaryGroupItems} />
          <SidebarGroup {...workspaceGroupItems} />
        </Sidebar.Content>
      </Sidebar>
      {children}
    </Sidebar.Provider>
  );
};
