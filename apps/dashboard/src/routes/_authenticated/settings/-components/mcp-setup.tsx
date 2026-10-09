import { useState } from "react";

import { CodeBlock, ListBox, Select } from "@namera-ai/ui";
import { BrandClaudeIcon, BrandOpenaiIcon } from "@namera-ai/ui/icons";

import { CopyIconButton } from "@/components/copy-icon-button";
import { DashboardCardContent, DashboardCardRoot } from "@/components/dashboard-card";
import { HeadingGroup } from "@/components/heading-group";

const clients = [
  {
    id: "codex",
    name: "Codex",
    icon: BrandOpenaiIcon,
    language: "bash",
    instruction: "With the Namera CLI installed, run this in your terminal.",
    code: "codex mcp add namera -- namera mcp serve --profile codex",
  },
  {
    id: "claude",
    name: "Claude Code",
    icon: BrandClaudeIcon,
    language: "bash",
    instruction: "With the Namera CLI installed, run this in your terminal.",
    code: "claude mcp add --transport stdio --scope user namera -- namera mcp serve --profile claude",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    logo: "/icons/mcp/gemini.svg",
    language: "bash",
    instruction: "With the Namera CLI installed, run this in your terminal.",
    code: "gemini mcp add --scope user --transport stdio namera namera mcp serve -- --profile gemini",
  },
] as const;

export function McpSetup() {
  const [client, setClient] = useState<string | number | null>("codex");
  const selected = clients.find((option) => option.id === client) ?? clients[0];

  return (
    <DashboardCardRoot className="mb-8">
      <DashboardCardContent className="space-y-3 divide-y-0 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <HeadingGroup>
            <HeadingGroup.Title level={2} size="sm">
              Connect an agent
            </HeadingGroup.Title>
            <HeadingGroup.Description>{selected.instruction}</HeadingGroup.Description>
          </HeadingGroup>
          <Select
            aria-label="MCP client"
            className="w-full sm:w-44 sm:shrink-0"
            selectedKey={selected.id}
            variant="secondary"
            onSelectionChange={setClient}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {clients.map((option) => (
                  <ListBox.Item key={option.id} id={option.id} textValue={option.name}>
                    <span className="flex items-center gap-2">
                      {"logo" in option ? (
                        <img
                          src={option.logo}
                          alt=""
                          aria-hidden
                          width={18}
                          height={18}
                          className="size-[18px] shrink-0"
                        />
                      ) : (
                        <option.icon aria-hidden className="size-[18px]" />
                      )}
                      {option.name}
                    </span>
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <CodeBlock
          aria-label={`${selected.name} setup command`}
          className="min-w-0 max-w-full flex-row items-center gap-2 rounded-lg border border-separator bg-background pr-2 [--font-mono:var(--font-geist-mono)]"
        >
          <CodeBlock.Code
            code={selected.code}
            language={selected.language}
            theme="github-dark-dimmed"
            darkTheme="github-dark-dimmed"
            className="min-w-0 flex-1 overflow-x-auto text-[13px]"
          />
          <CopyIconButton
            key={client}
            className="size-6 shrink-0 [&_svg]:size-3.5"
            label={`${selected.name} setup`}
            tooltipLabel="Copy"
            value={selected.code}
          />
        </CodeBlock>
      </DashboardCardContent>
    </DashboardCardRoot>
  );
}
