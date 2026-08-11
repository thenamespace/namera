import { Activity02Icon, DiscoverCircleIcon, Key01Icon, ShieldUserIcon } from "@namera-ai/ui/icons";

import type { SidebarGroupItemsProps } from "../sidebar-group";

export const coreGroupItems: SidebarGroupItemsProps = {
  ariaLabel: "Core",
  label: "Core",
  items: [
    {
      id: "accounts",
      icon: ShieldUserIcon,
      label: "Accounts",
      textValue: "Accounts",
      href: "/accounts",
      tooltip: {
        hotKey: "A",
        text: "accounts",
      },
    },
    {
      id: "session-keys",
      icon: Key01Icon,
      label: "Session Keys",
      textValue: "Session Keys",
      href: "/session-keys",
      tooltip: {
        hotKey: "S",
        text: "session keys",
      },
    },
    {
      id: "templates",
      icon: DiscoverCircleIcon,
      label: "Templates",
      textValue: "Templates",
      href: "/templates",
      tooltip: {
        hotKey: "T",
        text: "templates",
      },
    },
    {
      id: "activity",
      icon: Activity02Icon,
      label: "Activity",
      textValue: "Activity",
      href: "/activity",
      tooltip: {
        text: "activity",
      },
    },
  ],
};
