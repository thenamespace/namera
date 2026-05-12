import {
  SidebarContent,
  Sidebar as SidebarCore,
} from "@namera-ai/ui/components/ui/sidebar";

import { AdminGroup } from "./admin";
import { AgentGroup } from "./agents";
import { CoreGroup } from "./core";
import { Header } from "./header";
import { PrimaryGroup } from "./primary";

export const Sidebar = () => {
  return (
    <SidebarCore collapsible="icon">
      <Header />
      <SidebarContent>
        <PrimaryGroup />
        <CoreGroup />
        <AgentGroup />
        <AdminGroup />
      </SidebarContent>
    </SidebarCore>
  );
};
