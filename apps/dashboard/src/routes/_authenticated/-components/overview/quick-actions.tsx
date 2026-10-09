import { Link } from "@tanstack/react-router";

import { buttonVariants, Typography, Widget } from "@namera-ai/ui";
import { ApiIcon, BotIcon, HugeiconsIcon, Key01Icon, Wallet01Icon } from "@namera-ai/ui/icons";

import { hasPermissions } from "@/components/permission";
import { useCurrentUser } from "@/hooks/auth";

const actions = [
  {
    label: "Create account",
    icon: Wallet01Icon,
    to: "/accounts/new",
    permissions: ["wallet:create"],
  },
  {
    label: "Create session key",
    icon: Key01Icon,
    to: "/session-keys/new",
    permissions: ["session-key:create"],
  },
  {
    label: "Connect MCP",
    icon: BotIcon,
    to: "/settings/workspace/mcp",
    permissions: ["mcp-authorization:read"],
  },
  {
    label: "Create API key",
    icon: ApiIcon,
    to: "/settings/workspace/api-keys",
    permissions: ["api-key:read", "api-key:create"],
  },
] as const;

export function QuickActions() {
  const currentUser = useCurrentUser();
  const permissions = currentUser.data?.role.permissions ?? [];
  const availableActions = actions.filter((action) =>
    hasPermissions(permissions, action.permissions),
  );

  return (
    <Widget className="h-full">
      <Widget.Header className="pt-4 pb-4">
        <Widget.Title>Quick actions</Widget.Title>
      </Widget.Header>
      <Widget.Content className="px-4 pb-4">
        {availableActions.length > 0 ? (
          <nav aria-label="Quick actions" className="grid gap-3">
            {availableActions.map((action) => (
              <Link
                className={buttonVariants({
                  variant: "tertiary",
                  className: "h-14 w-full justify-start gap-3 rounded-xl border px-3",
                })}
                key={action.to}
                to={action.to}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface">
                  <HugeiconsIcon aria-hidden className="size-4 text-muted" icon={action.icon} />
                </span>
                {action.label}
              </Link>
            ))}
          </nav>
        ) : (
          <Typography.Paragraph color="muted" size="sm">
            Ask a workspace admin to help set up accounts and agent access.
          </Typography.Paragraph>
        )}
      </Widget.Content>
    </Widget>
  );
}
