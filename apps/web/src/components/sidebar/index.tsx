import {
  SidebarContent,
  Sidebar as SidebarCore,
} from "@repo/ui/components/ui/sidebar";

import { AdminGroup } from "./admin";
import { CoreGroup } from "./core";
import { Header } from "./header";
import { PrimaryGroup } from "./primary";

export function Sidebar() {
  return (
    <SidebarCore collapsible="icon">
      <Header />
      <SidebarContent>
        <PrimaryGroup />
        <CoreGroup />
        <AdminGroup />
      </SidebarContent>
    </SidebarCore>
  );
}
