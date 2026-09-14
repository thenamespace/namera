import { Typography } from "@namera-ai/ui";

import { CopyIconButton } from "@/components/copy-icon-button";
import { DashboardCardContent, DashboardCardRoot } from "@/components/dashboard-card";
import { HeadingGroup } from "@/components/heading-group";
import { env } from "@/env";

export function McpSetup() {
  const apiOrigin = new URL(env.backendUrl).origin;
  const host = `'${apiOrigin.replaceAll("'", "'\\''")}'`;
  const command = `codex mcp add namera -- namera mcp serve --profile codex --host ${host}`;
  const claudeCommand = `claude mcp add --transport stdio --scope user namera -- namera mcp serve --profile claude --host ${host}`;

  return (
    <DashboardCardRoot className="mb-8">
      <DashboardCardContent className="space-y-5 divide-y-0 p-4 sm:p-5">
        <HeadingGroup>
          <HeadingGroup.Title level={2} size="sm">
            Connect a local agent
          </HeadingGroup.Title>
          <HeadingGroup.Description>
            Your session keys stay on your computer. Use an MCP client that can connect locally.
          </HeadingGroup.Description>
        </HeadingGroup>
        <div className="space-y-2">
          <Typography className="text-sm!">
            With the Namera CLI installed, add it to Codex:
          </Typography>
          <div className="flex min-w-0 items-center gap-3 rounded-lg bg-surface-secondary px-3 py-2">
            <code className="min-w-0 flex-1 break-all text-sm">{command}</code>
            <CopyIconButton label="Codex setup command" value={command} />
          </div>
        </div>
        <div className="space-y-2">
          <Typography className="text-sm!">Or add it to Claude Code:</Typography>
          <div className="flex min-w-0 items-center gap-3 rounded-lg bg-surface-secondary px-3 py-2">
            <code className="min-w-0 flex-1 break-all text-sm">{claudeCommand}</code>
            <CopyIconButton label="Claude Code setup command" value={claudeCommand} />
          </div>
        </div>
        <Typography className="text-sm!" color="muted">
          Approve access in the browser and select your installed session keys. Import their
          encrypted exports on this computer with <code>namera session-key import</code> before
          signing. CLI login and API keys do not authorize MCP access.
        </Typography>
        <Typography className="text-sm!" color="muted">
          Your agent starts Namera automatically. Authorization is saved in your OS keyring and
          refreshed when needed. If browser login does not open, run{" "}
          <code>{`namera mcp login --profile codex --host ${host}`}</code> (use <code>claude</code>{" "}
          for Claude Code).
        </Typography>
      </DashboardCardContent>
    </DashboardCardRoot>
  );
}
