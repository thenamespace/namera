import { IdentityCardIcon, McpServerIcon } from "@namera-ai/ui/icons";

import type { SidebarGroupItemsProps } from "../sidebar-group";

export const agentsGroupItems: SidebarGroupItemsProps = {
  ariaLabel: "Agents",
  label: "Agents",
  items: [
    {
      id: "overview",
      icon: IdentityCardIcon,
      label: "Identity",
      textValue: "Identity",
      href: "/identity",
      tooltip: {
        text: "agent identity",
      },
    },
    {
      id: "mcp",
      icon: McpServerIcon,
      label: "MCP",
      textValue: "MCP",
      href: "/mcp",
      tooltip: {
        text: "mcp",
      },
    },
  ],
};
