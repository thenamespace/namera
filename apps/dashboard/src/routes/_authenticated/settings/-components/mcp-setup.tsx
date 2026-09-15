import { useState } from "react";

import { ListBox, Select } from "@namera-ai/ui";
import { ChatGptIcon, ClaudeIcon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { CopyIconButton } from "@/components/copy-icon-button";
import { DashboardCardContent, DashboardCardRoot } from "@/components/dashboard-card";
import { HeadingGroup } from "@/components/heading-group";
import { env } from "@/env";

export function McpSetup() {
  const [client, setClient] = useState<string | number | null>("codex");
  const apiOrigin = new URL(env.backendUrl).origin;
  const host = `'${apiOrigin.replaceAll("'", "'\\''")}'`;
  const command =
    client === "claude"
      ? `claude mcp add --transport stdio --scope user namera -- namera mcp serve --profile claude --host ${host}`
      : `codex mcp add namera -- namera mcp serve --profile codex --host ${host}`;
  const clientName = client === "claude" ? "Claude Code" : "Codex";

  return (
    <DashboardCardRoot className="mb-8">
      <DashboardCardContent className="space-y-3 divide-y-0 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <HeadingGroup>
            <HeadingGroup.Title level={2} size="sm">
              Connect an agent
            </HeadingGroup.Title>
            <HeadingGroup.Description>
              With the Namera CLI installed, run this in your terminal.
            </HeadingGroup.Description>
          </HeadingGroup>
          <Select
            aria-label="MCP client"
            className="w-full sm:w-44 sm:shrink-0"
            selectedKey={client}
            variant="secondary"
            onSelectionChange={setClient}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="codex" textValue="Codex">
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon aria-hidden icon={ChatGptIcon} size={18} />
                    Codex
                  </span>
                </ListBox.Item>
                <ListBox.Item id="claude" textValue="Claude Code">
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon aria-hidden icon={ClaudeIcon} size={18} />
                    Claude Code
                  </span>
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <div className="flex min-w-0 items-center gap-3 rounded-lg bg-surface-secondary px-3 py-2">
          <code className="min-w-0 flex-1 break-all text-sm">{command}</code>
          <CopyIconButton key={client} label={`${clientName} setup command`} value={command} />
        </div>
      </DashboardCardContent>
    </DashboardCardRoot>
  );
}
