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
import { McpIcon } from "@namera-ai/ui/icons";
import {
  IdentificationBadgeIcon,
  TriangleIcon,
} from "@phosphor-icons/react/ssr";

const items = [
  {
    href: "/dashboard",
    icon: IdentificationBadgeIcon,
    title: "Identity",
    tooltip: {
      text: "agent identity",
    },
  },
  {
    href: "/dashboard",
    icon: McpIcon,
    title: "MCP",
    tooltip: {
      text: "mcp",
    },
  },
] as const;

export const AgentGroup = () => {
  return (
    <SidebarGroup>
      <Collapsible className="flex w-full flex-col gap-1" defaultOpen={true}>
        <CollapsibleTrigger
          className="group"
          render={
            <SidebarGroupLabel className="h-5 select-none cursor-pointer flex flex-row gap-1.5 items-center" />
          }
        >
          Agents
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
                  tooltip={{
                    children: <div>Go to {item.tooltip.text}</div>,
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
