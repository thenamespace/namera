import { Activity02Icon, BookOpen01Icon, Key01Icon, ShieldUserIcon } from "@namera-ai/ui/icons";

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
      id: "recipes",
      icon: BookOpen01Icon,
      label: "Recipes",
      textValue: "Recipes",
      href: "/recipes",
      tooltip: { text: "recipes" },
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
