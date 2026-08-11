import { DashboardSquare01Icon, EthereumEllipseIcon } from "@namera-ai/ui/icons";

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
      id: "assets",
      icon: EthereumEllipseIcon,
      label: "Assets",
      textValue: "Assets",
      href: "/assets",
      tooltip: {
        text: "assets",
      },
    },
  ],
};
