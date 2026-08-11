import { Settings02Icon } from "@namera-ai/ui/icons";

import type { SidebarGroupItemsProps } from "../sidebar-group";

export const adminGroupItems: SidebarGroupItemsProps = {
  ariaLabel: "Admin",
  label: "Admin",
  items: [
    {
      id: "settings",
      icon: Settings02Icon,
      label: "Settings",
      textValue: "Settings",
      href: "/settings",
      tooltip: {
        text: "settings",
      },
    },
  ],
};
