// oxlint-disable react-perf/jsx-no-new-object-as-prop
import { Link } from "@tanstack/react-router";

import { buttonVariants, CopyIconButton, Typography } from "@namera-ai/ui";

import type { useGettingStarted } from "@/hooks/getting-started";

import { McpConnection } from "./mcp-connection";

const primaryLink = buttonVariants({ variant: "primary", size: "sm" });
const secondaryLink = buttonVariants({ variant: "secondary", size: "sm" });
const onboardingSearch = { from: "get-started" } as const;
const sessionPresetSearch = { preset: "get-started", from: "get-started" } as const;
const starterPrompts = [
  {
    title: "Sign a message",
    label: "message signing prompt",
    text: 'Use Namera MCP to sign "Hello from Namera" with my session key.',
  },
  {
    title: "Send a transaction",
    label: "transaction prompt",
    text: "Use Namera MCP to send a transaction. Ask for the recipient and amount, then confirm before sending.",
  },
] as const;

export function StepActions({
  step,
  complete,
  setup,
}: {
  step: number;
  complete: boolean;
  setup: ReturnType<typeof useGettingStarted>;
}) {
  if (step === 0) {
    if (complete)
      return (
        <Link to="/accounts" className={secondaryLink}>
          View accounts
        </Link>
      );
    return setup.permissions.includes("wallet:create") ? (
      <Link to="/accounts/new" search={onboardingSearch} className={primaryLink}>
        Create account
      </Link>
    ) : (
      <p className="text-sm text-muted">Ask a workspace admin to create an account.</p>
    );
  }

  if (step === 1) {
    if (complete)
      return (
        <Link to="/session-keys" className={secondaryLink}>
          View session keys
        </Link>
      );
    if (setup.approvalSessionKey)
      return (
        <Link
          to="/session-key/$sessionKeyId/overview"
          params={{ sessionKeyId: setup.approvalSessionKey.id }}
          className={primaryLink}
        >
          {setup.approvalSessionKey.installations.some(
            (installation) => installation.status === "submitted",
          )
            ? "View network approval"
            : "Approve session key"}
        </Link>
      );
    if (!setup.completed[0])
      return (
        <p className="text-sm text-muted">Create your account first, then add a session key.</p>
      );
    return setup.permissions.includes("session-key:create") ? (
      <Link to="/session-keys/new" search={sessionPresetSearch} className={primaryLink}>
        Create session key
      </Link>
    ) : (
      <p className="text-sm text-muted">Ask a workspace admin to create a session key.</p>
    );
  }

  if (step === 2) {
    return setup.permissions.includes("mcp-authorization:read") ? (
      <McpConnection complete={complete} />
    ) : (
      <p className="text-sm text-muted">Ask a workspace admin to help connect your AI client.</p>
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
      <div className="space-y-3">
        {starterPrompts.map((prompt) => (
          <section
            key={prompt.label}
            aria-label={prompt.label}
            className="rounded-lg border border-separator bg-surface/50 p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <Typography.Heading level={3} className="text-sm" weight="medium">
                {prompt.title}
              </Typography.Heading>
              <CopyIconButton label={prompt.label} value={prompt.text} tooltipLabel="Copy prompt" />
            </div>
            <Typography.Paragraph size="sm" color="muted" className="leading-relaxed">
              {prompt.text}
            </Typography.Paragraph>
          </section>
        ))}
      </div>
      <Link to="/session-keys" className={secondaryLink}>
        Check session permissions
      </Link>
    </div>
  );
}
