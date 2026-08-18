import { Surface, Typography } from "@namera-ai/ui";
import { HugeiconsIcon, McpServerIcon } from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { CopyIconButton } from "@/components/copy-icon-button";
import { env } from "@/env";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

const trailingSlash = /\/$/u;
const mcpServerUrl = `${env.backendUrl.replace(trailingSlash, "")}/mcp`;
export function McpInstallation() {
  const handleCopySuccess = useEventCallback(() =>
    showSuccessToast({ title: "MCP server URL copied" }),
  );
  const handleCopyError = useEventCallback(() =>
    showErrorToast(undefined, { title: "Couldn’t copy MCP server URL" }),
  );

  return (
    <Surface className="rounded-xl p-4 sm:p-5" variant="secondary">
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center">
          <HugeiconsIcon className="size-8" icon={McpServerIcon} />
        </span>
        <div className="min-w-0 flex-1">
          <Typography weight="medium">Remote MCP server</Typography>
          <Typography.Paragraph className="mt-1" color="muted" size="sm">
            Add this URL to Codex, Claude, or another remote HTTP MCP client. Namera will open in
            your browser so you can choose the accounts and session keys it may use.
          </Typography.Paragraph>
        </div>
      </div>
      <div className="border-separator bg-background mt-4 flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2">
        <code className="text-content-secondary min-w-0 flex-1 truncate text-xs">
          {mcpServerUrl}
        </code>
        <CopyIconButton
          label="MCP server URL"
          value={mcpServerUrl}
          onCopyError={handleCopyError}
          onCopySuccess={handleCopySuccess}
        />
      </div>
    </Surface>
  );
}
