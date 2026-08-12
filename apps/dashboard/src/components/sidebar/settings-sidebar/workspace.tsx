import { CreditCardIcon, UserMultiple02Icon, WorkIcon } from "@namera-ai/ui/icons";

import type { SidebarGroupItemsProps } from "../sidebar-group";

export const workspaceGroupItems: SidebarGroupItemsProps = {
  ariaLabel: "Admin",
  label: "Admin",
  items: [
    {
      exact: true,
      id: "workspace",
      icon: WorkIcon,
      label: "Workspace",
      textValue: "Workspace",
      href: "/settings/workspace",
      tooltip: {
        text: "workspace",
      },
    },
    {
      id: "members",
      icon: UserMultiple02Icon,
      label: "Members",
      textValue: "Members",
      href: "/settings/workspace/members",
      tooltip: {
        text: "Members",
      },
    },
    {
      id: "billings",
      icon: CreditCardIcon,
      label: "Billings",
      textValue: "Billings",
      href: "/settings/workspace/billings",
      tooltip: {
        text: "Billings",
      },
    },
  ],
};
