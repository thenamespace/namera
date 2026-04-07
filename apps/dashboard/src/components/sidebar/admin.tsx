import { Link } from "@tanstack/react-router";

import {
  GearSixIcon,
  ShieldCheckIcon,
  TriangleIcon,
} from "@phosphor-icons/react/ssr";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@namera-ai/ui/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@namera-ai/ui/components/ui/sidebar";

const items = [
  {
    href: "/dashboard/security",
    icon: ShieldCheckIcon,
    title: "Security",
    tooltip: {
      text: "security",
    },
  },
  {
    href: "/dashboard/settings",
    icon: GearSixIcon,
    title: "Settings",
    tooltip: {
      text: "settings",
    },
  },
] as const;

export const AdminGroup = () => {
  return (
    <SidebarGroup>
      <Collapsible className="flex w-full flex-col gap-1" defaultOpen={true}>
        <CollapsibleTrigger
          className="group"
          nativeButton={false}
          render={
            <SidebarGroupLabel className="flex h-5 cursor-pointer flex-row items-center gap-1.5 select-none" />
          }
        >
          Admin
          <TriangleIcon
            className="size-2! rotate-90 transition-all group-data-panel-open:rotate-180"
            weight="fill"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex h-(--collapsible-panel-height) flex-col justify-end overflow-hidden text-sm transition-all duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
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
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
};
