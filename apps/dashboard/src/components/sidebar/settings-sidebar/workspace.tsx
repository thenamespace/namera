import {
  ApiIcon,
  CreditCardIcon,
  McpServerIcon,
  TerminalIcon,
  UserMultiple02Icon,
  WorkIcon,
} from "@namera-ai/ui/icons";

import type { SidebarGroupItemsProps } from "../sidebar-group";

export const workspaceGroupItems: SidebarGroupItemsProps = {
  ariaLabel: "Workspace",
  label: "Workspace",
  items: [
    {
      exact: true,
      id: "workspace",
      icon: WorkIcon,
      label: "Workspace",
      textValue: "Workspace",
      href: "/settings/workspace",
      tooltip: {
        text: "workspace",
      },
    },
    {
      id: "members",
      icon: UserMultiple02Icon,
      label: "Members",
      textValue: "Members",
      href: "/settings/workspace/members",
      tooltip: {
        text: "Members",
      },
    },
    {
      id: "api-keys",
      icon: ApiIcon,
      label: "API keys",
      textValue: "API keys",
      href: "/settings/workspace/api-keys",
      tooltip: {
        text: "API keys",
      },
    },
    {
      id: "mcp",
      icon: McpServerIcon,
      label: "MCP",
      textValue: "MCP",
      href: "/settings/workspace/mcp",
      tooltip: {
        text: "MCP",
      },
    },
    {
      id: "cli-authorizations",
      icon: TerminalIcon,
      label: "CLI access",
      textValue: "CLI access",
      href: "/settings/workspace/cli-authorizations",
      tooltip: {
        text: "CLI access",
      },
    },
    {
      id: "billings",
      icon: CreditCardIcon,
      label: "Billings",
      textValue: "Billings",
      href: "/settings/workspace/billings",
      tooltip: {
        text: "Billings",
      },
    },
  ],
};
