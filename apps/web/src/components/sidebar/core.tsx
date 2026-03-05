import { Link } from "@tanstack/react-router";

import {
  FlaskIcon,
  KeyIcon,
  PulseIcon,
  TriangleIcon,
} from "@phosphor-icons/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import { Kbd } from "@repo/ui/components/ui/kbd";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";

const items = [
  {
    href: "/dashboard",
    icon: KeyIcon,
    title: "Session Keys",
    tooltip: {
      hotKey: "S",
      text: "session keys",
    },
  },
  {
    href: "/dashboard",
    icon: FlaskIcon,
    title: "Permissions",
    tooltip: {
      hotKey: "P",
      text: "permissions",
    },
  },
  {
    href: "/dashboard",
    icon: PulseIcon,
    title: "Activity",
    tooltip: {
      hotKey: "A",
      text: "activity",
    },
  },
] as const;

export const CoreGroup = () => {
  return (
    <SidebarGroup>
      <Collapsible className="flex w-full flex-col gap-2" defaultOpen={true}>
        <CollapsibleTrigger
          className="group"
          render={
            <SidebarGroupLabel className="h-5 select-none cursor-pointer flex flex-row gap-1.5 items-center" />
          }
        >
          Observability
          <TriangleIcon
            className="rotate-90 size-2! group-data-panel-open:rotate-180 transition-all"
            weight="fill"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex [&[hidden]:not([hidden='until-found'])]:hidden h-(--collapsible-panel-height) flex-col justify-end overflow-hidden text-sm transition-all ease-out data-ending-style:h-0 data-starting-style:h-0 duration-300">
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={<Link to={item.href} />}
                  tooltip={{
                    children: (
                      <div className="flex flex-row gap-1 items-center">
                        <div>Go to {item.tooltip.text}</div>
                        <div>
                          <Kbd>G</Kbd> then <Kbd>{item.tooltip.hotKey}</Kbd>
                        </div>
                      </div>
                    ),
                  }}
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
