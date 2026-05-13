import { formatForDisplay } from "@tanstack/react-hotkeys";

import { SidebarIcon } from "@phosphor-icons/react";

import { Kbd } from "@namera-ai/ui/components/ui/kbd";
import {
  SidebarContent,
  Sidebar as SidebarCore,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@namera-ai/ui/components/ui/sidebar";

import { AdminGroup } from "./admin";
import { AgentGroup } from "./agents";
import { CoreGroup } from "./core";
import { Header } from "./header";
import { PrimaryGroup } from "./primary";

const SidebarToggle = () => {
  const { open, toggleSidebar } = useSidebar();
  if (open) return null;

  return (
    <SidebarGroup>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={{
              children: (
                <div className="flex flex-row items-center gap-1">
                  Toggle Sidebar
                  <Kbd>{formatForDisplay("Mod+B")}</Kbd>
                </div>
              ),
            }}
            onClick={() => {
              toggleSidebar();
            }}
          >
            <SidebarIcon />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
};

export const Sidebar = () => {
  return (
    <SidebarCore collapsible="icon">
      <Header />
      <SidebarContent>
        <SidebarToggle />
        <PrimaryGroup />
        <CoreGroup />
        <AgentGroup />
        <AdminGroup />
      </SidebarContent>
    </SidebarCore>
  );
};
