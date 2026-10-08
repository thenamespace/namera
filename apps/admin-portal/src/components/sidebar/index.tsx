import type { PropsWithChildren } from "react";
import { useCallback } from "react";

import { useNavigate } from "@tanstack/react-router";

import { Sidebar } from "@namera-ai/ui";

import { SidebarHeader } from "./header";
import { navigationGroups } from "./navigation";
import { SidebarGroup } from "./sidebar-group";

export function AdminSidebar({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const navigateTo = useCallback((href: string) => void navigate({ to: href }), [navigate]);

  return (
    <Sidebar.Provider variant="inset" collapsible="offcanvas" navigate={navigateTo}>
      <Sidebar>
        <SidebarHeader />
        <Sidebar.Content>
          {navigationGroups.map((group) => (
            <SidebarGroup key={group.label} group={group} />
          ))}
        </Sidebar.Content>
      </Sidebar>
      {children}
    </Sidebar.Provider>
  );
}
