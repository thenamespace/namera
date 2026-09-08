import { Typography } from "@namera-ai/ui";

import { CopyIconButton } from "@/components/copy-icon-button";
import { DashboardCardContent, DashboardCardRoot } from "@/components/dashboard-card";
import { HeadingGroup } from "@/components/heading-group";
import { env } from "@/env";

export function McpSetup() {
  const apiOrigin = new URL(env.backendUrl).origin;
  const command = `namera mcp start --host '${apiOrigin.replaceAll("'", "'\\''")}'`;
  const endpoint = "http://127.0.0.1:3847/mcp";

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
            With the Namera CLI installed, run this in your terminal.
          </Typography>
          <div className="flex min-w-0 items-center gap-3 rounded-lg bg-surface-secondary px-3 py-2">
            <code className="min-w-0 flex-1 break-all text-sm">{command}</code>
            <CopyIconButton label="MCP start command" value={command} />
          </div>
        </div>
        <div className="space-y-2">
          <Typography className="text-sm!">
            Add this HTTP server URL in your agent’s MCP settings.
          </Typography>
          <div className="flex min-w-0 items-center gap-3 rounded-lg bg-surface-secondary px-3 py-2">
            <code className="min-w-0 flex-1 break-all text-sm">{endpoint}</code>
            <CopyIconButton label="Local MCP URL" value={endpoint} />
          </div>
        </div>
        <Typography className="text-sm!" color="muted">
          Approve access in the browser and select your installed session keys. Import their
          encrypted exports on this computer with <code>namera session-key import</code> before
          signing. CLI login and API keys do not authorize MCP access.
        </Typography>
        <Typography className="text-sm!" color="muted">
          Keep the terminal running. Restarting requires connecting and approving access again; your
          imported keys are retained.
        </Typography>
      </DashboardCardContent>
    </DashboardCardRoot>
  );
}
