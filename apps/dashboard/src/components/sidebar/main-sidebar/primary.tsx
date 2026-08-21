import { DashboardSquare01Icon, InboxIcon } from "@namera-ai/ui/icons";

import type { SidebarGroupItemsProps } from "../sidebar-group";

export const primaryGroupItems: SidebarGroupItemsProps = {
  ariaLabel: "Primary",
  label: "Primary",
  items: [
    {
      id: "overview",
      icon: DashboardSquare01Icon,
      label: "Overview",
      textValue: "Overview",
      href: "/",
      tooltip: {
        text: "overview",
        hotKey: "o",
      },
    },
    {
      id: "inbox",
      icon: InboxIcon,
      label: "Inbox",
      textValue: "Inbox",
      href: "/inbox",
      tooltip: {
        text: "inbox",
      },
    },
  ],
};
