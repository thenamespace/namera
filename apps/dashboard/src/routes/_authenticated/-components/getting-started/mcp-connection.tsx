import { useState } from "react";

import { Link } from "@tanstack/react-router";

import {
  buttonVariants,
  CodeBlock,
  CopyIconButton,
  ListBox,
  Select,
  Typography,
} from "@namera-ai/ui";
import { HugeiconsIcon, LinkSquare02Icon } from "@namera-ai/ui/icons";

import { mcpClients } from "@/lib/mcp-clients";

const installCommand = "npm install -g @namera-ai/cli";
const discoveryPrompt = "Use Namera MCP to list my accounts and session keys.";
const manageLink = buttonVariants({ variant: "secondary", size: "sm" });

export function McpConnection({ complete }: { complete: boolean }) {
  const [client, setClient] = useState<string | number | null>("claude");
  const selected = mcpClients.find((option) => option.id === client) ?? mcpClients[0];

  return (
    <div className="min-w-0 space-y-5">
      <ol aria-label="Connect your AI client" className="min-w-0 space-y-6">
        <li className="min-w-0 space-y-2.5">
          <Typography.Heading level={3} className="text-sm" weight="medium">
            <span className="mr-2 text-muted">1.</span> Install the Namera CLI
          </Typography.Heading>
          <SetupSnippet label="Install Namera CLI" value={installCommand} />
        </li>
        <li className="min-w-0 space-y-2.5">
          <Typography.Heading level={3} className="text-sm" weight="medium">
            <span className="mr-2 text-muted">2.</span> Add Namera to your client
          </Typography.Heading>
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <SetupSnippet
                key={selected.id}
                label={`${selected.name} MCP setup`}
                value={selected.code}
              />
            </div>
            <Select
              aria-label="MCP client"
              className="w-40 shrink-0"
              selectedKey={selected.id}
              variant="secondary"
              onSelectionChange={setClient}
            >
              <Select.Trigger className="whitespace-nowrap">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {mcpClients.map((option) => (
                    <ListBox.Item key={option.id} id={option.id} textValue={option.name}>
                      <span className="flex items-center gap-2 whitespace-nowrap">
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
                          <option.icon aria-hidden className="size-[18px] shrink-0" />
                        )}
                        {option.name}
                      </span>
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <Typography.Paragraph size="sm" color="muted" className="leading-relaxed">
            Using another client?{" "}
            <a
              href="https://namera.ai/docs/mcp/clients"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
            >
              View setup guides <HugeiconsIcon aria-hidden icon={LinkSquare02Icon} size={14} />
            </a>
          </Typography.Paragraph>
        </li>
        <li className="min-w-0 space-y-2.5">
          <Typography.Heading level={3} className="text-sm" weight="medium">
            <span className="mr-2 text-muted">3.</span> Try your first prompt
          </Typography.Heading>
          <SetupSnippet label="First Namera request" value={discoveryPrompt} language="text" />
        </li>
      </ol>
      {complete ? (
        <Link to="/settings/workspace/mcp" className={manageLink}>
          Manage AI clients
        </Link>
      ) : (
        <Typography.Paragraph size="xs" color="muted" className="leading-relaxed">
          This step completes after your AI client makes its first authenticated request.
        </Typography.Paragraph>
      )}
    </div>
  );
}

function SetupSnippet({
  label,
  value,
  language = "bash",
}: {
  label: string;
  value: string;
  language?: "bash" | "text";
}) {
  return (
    <CodeBlock
      aria-label={label}
      className="my-0 min-w-0 max-w-full flex-row items-center gap-1 rounded-lg border border-separator bg-surface/50 pr-2 [--font-mono:var(--font-geist-mono)]"
    >
      <CodeBlock.Code
        code={value}
        language={language}
        theme="github-dark-dimmed"
        darkTheme="github-dark-dimmed"
        title={value}
        className="min-w-0 flex-1 overflow-hidden text-[13px] leading-relaxed [&_pre]:overflow-hidden [&_pre]:whitespace-nowrap"
      />
      <CopyIconButton
        className="size-7 shrink-0 [&_svg]:size-3.5"
        label={label}
        tooltipLabel="Copy"
        value={value}
      />
    </CodeBlock>
  );
}
