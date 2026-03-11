import {
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@namera-ai/ui/components/ui/sidebar";

import { AccountSwitcher } from "./account-switcher";

export const Header = () => {
  const { open } = useSidebar();
  return (
    <SidebarHeader className="flex flex-row items-center justify-between px-2!">
      <AccountSwitcher />
      {open && <SidebarTrigger />}
    </SidebarHeader>
  );
};
