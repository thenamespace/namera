import { useCallback, useState } from "react";

import { Link } from "@tanstack/react-router";

import { buttonVariants, CopyIconButton, Segment } from "@namera-ai/ui";

import type { useGettingStarted } from "@/hooks/getting-started";

const integrations = {
  mcp: {
    label: "MCP",
    description:
      "Connect an AI client, authorize your session key, then ask it to list your accounts.",
    href: "https://namera.ai/docs/mcp/getting-started",
  },
  sdk: {
    label: "SDK",
    description:
      "Create an API key with access to your session key, then list your accounts from your code.",
    href: "https://namera.ai/docs/sdk/getting-started",
  },
  cli: {
    label: "CLI",
    description:
      "Install the CLI, sign in, and authorize your session key. Then run namera wallet list.",
    href: "https://namera.ai/docs/cli/getting-started",
  },
} as const;

const primaryLink = buttonVariants({ variant: "primary", size: "sm" });
const secondaryLink = buttonVariants({ variant: "secondary", size: "sm" });
const firstActionPrompt =
  'Help me sign the message "Hello from Namera" with Namera. First list my accounts and session keys, then ask which account, session key, and network to use. Check that signatures are permitted, explain the request, and wait for my approval before signing. If setup is incomplete, explain what I need to finish.';

export function StepActions({
  step,
  complete,
  setup,
}: {
  step: number;
  complete: boolean;
  setup: ReturnType<typeof useGettingStarted>;
}) {
  const [integration, setIntegration] = useState<keyof typeof integrations>("mcp");
  const selected = integrations[integration];
  const selectIntegration = useCallback((key: string | number | null) => {
    if (key === "sdk" || key === "cli" || key === "mcp") setIntegration(key);
  }, []);

  if (step === 0) {
    if (complete)
      return (
        <Link to="/accounts" className={secondaryLink}>
          View accounts
        </Link>
      );
    return setup.permissions.includes("wallet:create") ? (
      <Link to="/accounts/new" className={primaryLink}>
        Create account
      </Link>
    ) : (
      <p className="text-sm text-muted">Ask a workspace admin to create a wallet.</p>
    );
  }

  if (step === 1) {
    if (complete)
      return (
        <Link to="/session-keys" className={secondaryLink}>
          View session keys
        </Link>
      );
    if (!setup.completed[0])
      return (
        <p className="text-sm text-muted">Create your wallet first, then add a session key.</p>
      );
    return setup.permissions.includes("session-key:create") ? (
      <Link to="/session-keys/new" className={primaryLink}>
        Create session key
      </Link>
    ) : (
      <p className="text-sm text-muted">Ask a workspace admin to create a session key.</p>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-4">
        <Segment
          aria-label="Connection method"
          size="sm"
          selectedKey={integration}
          onSelectionChange={selectIntegration}
        >
          {Object.entries(integrations).map(([id, option]) => (
            <Segment.Item id={id} key={id}>
              {option.label}
            </Segment.Item>
          ))}
        </Segment>
        <p className="max-w-sm text-sm leading-relaxed text-muted">{selected.description}</p>
        <div className="flex flex-wrap gap-3">
          {integration === "mcp" && setup.permissions.includes("mcp-authorization:read") ? (
            <Link to="/settings/workspace/mcp" className={primaryLink}>
              Connect MCP
            </Link>
          ) : integration === "sdk" &&
            setup.permissions.includes("api-key:create") &&
            setup.permissions.includes("api-key:read") ? (
            <Link to="/settings/workspace/api-keys" className={primaryLink}>
              Create API key
            </Link>
          ) : (
            <a href={selected.href} target="_blank" rel="noreferrer" className={primaryLink}>
              Set up {selected.label}
            </a>
          )}
          <a
            href={selected.href}
            target="_blank"
            rel="noreferrer"
            className="self-center text-sm text-muted underline underline-offset-4 hover:text-foreground"
          >
            Read the guide ↗
          </a>
        </div>
        {!complete ? (
          <p className="text-xs leading-relaxed text-muted">
            This step completes after your integration makes an authenticated request. Progress
            refreshes automatically.
          </p>
        ) : null}
      </div>
    );
  }

  if (complete)
    return (
      <Link to="/activity" className={secondaryLink}>
        View activity
      </Link>
    );

  return (
    <div className="space-y-4">
      <Segment
        aria-label="First action method"
        size="sm"
        selectedKey={integration}
        onSelectionChange={selectIntegration}
      >
        {Object.entries(integrations).map(([id, option]) => (
          <Segment.Item id={id} key={id}>
            {option.label}
          </Segment.Item>
        ))}
      </Segment>
      <p className="max-w-sm text-sm leading-relaxed text-muted">
        {integration === "mcp"
          ? "Ask your connected AI client to help you sign “Hello from Namera”. Choose your wallet, session key, and network, then review the request."
          : "Follow the signing guide to sign a message with your wallet and session key. Use a session key that permits message signatures."}
      </p>
      <div className="flex flex-wrap gap-3">
        {integration === "mcp" ? (
          <div className="flex items-center gap-2 rounded-lg border border-separator px-3 py-1 text-sm">
            <span>Copy a starter prompt</span>
            <CopyIconButton label="first-action prompt" value={firstActionPrompt} />
          </div>
        ) : (
          <a
            href={`https://namera.ai/docs/${integration}/guides/signing/sign-messages`}
            target="_blank"
            rel="noreferrer"
            className={primaryLink}
          >
            Sign a message
          </a>
        )}
        <Link to="/session-keys" className={secondaryLink}>
          Check permissions
        </Link>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        A signature doesn’t move funds. Transactions count after confirmation; simulations and
        pending submissions don’t count.
      </p>
      <a
        href={`https://namera.ai/docs/${integration === "cli" ? "cli" : "sdk"}/getting-started`}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-sm text-muted underline underline-offset-4 hover:text-foreground"
      >
        Prefer a transaction? Follow the quickstart ↗
      </a>
    </div>
  );
}
