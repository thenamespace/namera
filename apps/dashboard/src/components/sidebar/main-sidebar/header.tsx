import {
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@namera-ai/ui/components/ui/sidebar";

import { TeamDropdownButton } from "./team-dropdown";

export const Header = () => {
  const { open } = useSidebar();
  return (
    <SidebarHeader className="flex flex-row items-center justify-between px-2!">
      <TeamDropdownButton />
      {/* <AccountSwitcher /> */}
      {open && <SidebarTrigger />}
    </SidebarHeader>
  );
};
