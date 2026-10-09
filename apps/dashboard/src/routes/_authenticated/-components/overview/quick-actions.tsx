import { Link } from "@tanstack/react-router";

import { buttonVariants, Typography, Widget } from "@namera-ai/ui";
import {
  ApiIcon,
  ArrowRight01Icon,
  BotIcon,
  HugeiconsIcon,
  Key01Icon,
  UserAdd01Icon,
  Wallet01Icon,
} from "@namera-ai/ui/icons";

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
  {
    label: "Invite members",
    icon: UserAdd01Icon,
    to: "/settings/workspace/members",
    permissions: ["invitation:create"],
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
      <div className="flex-1 px-2 pb-2">
        {availableActions.length > 0 ? (
          <nav aria-label="Quick actions" className="grid gap-1">
            {availableActions.map((action) => (
              <Link
                className={buttonVariants({
                  variant: "ghost",
                  className:
                    "h-14 w-full justify-start gap-3 rounded-lg bg-default/40 px-2 transition-colors hover:bg-default/80",
                })}
                key={action.to}
                to={action.to}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface/60">
                  <HugeiconsIcon aria-hidden className="size-4 text-muted" icon={action.icon} />
                </span>
                {action.label}
                <HugeiconsIcon
                  aria-hidden
                  className="ml-auto size-4 shrink-0 text-muted"
                  icon={ArrowRight01Icon}
                />
              </Link>
            ))}
          </nav>
        ) : (
          <Typography.Paragraph color="muted" size="sm">
            Ask a workspace admin to help set up accounts and agent access.
          </Typography.Paragraph>
        )}
      </div>
    </Widget>
  );
}
