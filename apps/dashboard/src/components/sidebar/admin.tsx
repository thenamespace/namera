import { Link } from "@tanstack/react-router";

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
import {
  GearSixIcon,
  ShieldCheckIcon,
  TriangleIcon,
} from "@phosphor-icons/react/ssr";

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
          render={
            <SidebarGroupLabel className="h-5 select-none cursor-pointer flex flex-row gap-1.5 items-center" />
          }
        >
          Admin
          <TriangleIcon
            className="rotate-90 size-2! group-data-panel-open:rotate-180 transition-all"
            weight="fill"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex [&[hidden]:not([hidden='until-found'])]:hidden h-(--collapsible-panel-height) flex-col justify-end overflow-hidden text-sm transition-all ease-out data-ending-style:h-0 data-starting-style:h-0 duration-150">
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
