import {
  SidebarContent,
  Sidebar as SidebarCore,
} from "@namera-ai/ui/components/ui/sidebar";

import { CoreGroup } from "./core";
import { Header } from "./header";

export const SettingsSidebar = () => {
  return (
    <SidebarCore collapsible="icon">
      <Header />
      <SidebarContent>
        <CoreGroup />
      </SidebarContent>
    </SidebarCore>
  );
};
