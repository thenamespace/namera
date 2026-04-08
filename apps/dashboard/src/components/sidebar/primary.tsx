import { Link } from "@tanstack/react-router";

import { CardholderIcon, HeadCircuitIcon } from "@phosphor-icons/react/ssr";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@namera-ai/ui/components/ui/sidebar";

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
              render={
                <Link
                  to={item.href}
                  activeOptions={{
                    exact: true,
                  }}
                  activeProps={{
                    className: "bg-sidebar-accent",
                  }}
                />
              }
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
