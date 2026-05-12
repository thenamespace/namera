import {
  IdentificationBadgeIcon,
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
} from "@namera-ai/ui/components/ui/sidebar";
import { McpIcon } from "@namera-ai/ui/icons";

import { SidebarButton } from "../sidebar-button";

const items = [
  {
    href: "/dashboard/identity",
    icon: IdentificationBadgeIcon,
    title: "Identity",
    tooltip: {
      text: "agent identity",
    },
  },
  {
    href: "/dashboard/mcp",
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
          nativeButton={false}
          render={
            <SidebarGroupLabel className="flex h-5 cursor-pointer flex-row items-center gap-1.5 select-none" />
          }
        >
          Agents
          <TriangleIcon
            className="size-2! rotate-90 transition-all group-data-panel-open:rotate-180"
            weight="fill"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex h-(--collapsible-panel-height) flex-col justify-end overflow-hidden text-sm transition-all duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
          <SidebarMenu>
            {items.map((item) => (
              <SidebarButton key={item.title} {...item} />
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
};
