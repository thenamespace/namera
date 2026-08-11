import { NotificationSquareIcon, SecurityIcon, UserCircleIcon } from "@namera-ai/ui/icons";

import type { SidebarGroupItemsProps } from "../sidebar-group";

export const primaryGroupItems: SidebarGroupItemsProps = {
  ariaLabel: "Primary",
  label: "Primary",
  items: [
    {
      id: "profile",
      icon: UserCircleIcon,
      label: "Profile",
      textValue: "Profile",
      href: "/settings/profile",
      tooltip: {
        text: "profile",
      },
    },
    {
      id: "notifications",
      icon: NotificationSquareIcon,
      label: "Notifications",
      textValue: "Notifications",
      href: "/settings/notifications",
      tooltip: {
        text: "Notifications",
      },
    },
    {
      id: "security",
      icon: SecurityIcon,
      label: "Security",
      textValue: "Security",
      href: "/settings/security",
      tooltip: {
        text: "Security",
      },
    },
  ],
};
