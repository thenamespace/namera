import { Link } from "@tanstack/react-router";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@namera-ai/ui/components/ui/sidebar";
import { CardholderIcon, HeadCircuitIcon } from "@phosphor-icons/react/ssr";

const items = [
  {
    href: "/dashboard",
    icon: HeadCircuitIcon,
    title: "Overview",
    tooltip: {
      text: "overview",
    },
  },
  {
    href: "/dashboard/assets",
    icon: CardholderIcon,
    title: "Assets",
    tooltip: {
      text: "assets",
    },
  },
] as const;

export const PrimaryGroup = () => {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              render={<Link to={item.href} />}
              tooltip={`Go to ${item.tooltip.text}`}
            >
              <item.icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
};
