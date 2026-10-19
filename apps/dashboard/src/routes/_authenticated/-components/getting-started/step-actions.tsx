import { Link } from "@tanstack/react-router";

import { buttonVariants, CopyIconButton, Typography } from "@namera-ai/ui";
import { HugeiconsIcon, LinkSquare02Icon } from "@namera-ai/ui/icons";

import type { useGettingStarted } from "@/hooks/getting-started";

const primaryLink = buttonVariants({ variant: "primary", size: "sm" });
const secondaryLink = buttonVariants({ variant: "secondary", size: "sm" });
const onboardingSearch = { from: "get-started" } as const;
const sessionPresetSearch = { preset: "get-started" } as const;
const starterPrompts = [
  {
    title: "Sign a message",
    label: "message signing prompt",
    text: 'Help me sign "Hello from Namera". Let me choose my account, session key, and network. Check that the key allows message signing, explain the request, and ask for my approval before signing.',
  },
  {
    title: "Send a transaction",
    label: "transaction prompt",
    text: "Help me send my first Namera transaction. Ask me to choose my account, session key, network, recipient, and amount. Check the permissions, simulate the transaction, and show me the details and fees. Wait for my approval before sending. If setup is incomplete, explain what I need to finish.",
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
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          {setup.permissions.includes("mcp-authorization:read") ? (
            <Link to="/settings/workspace/mcp" className={primaryLink}>
              {complete ? "Manage AI clients" : "Connect AI client"}
            </Link>
          ) : (
            <p className="text-sm text-muted">
              Ask a workspace admin to help connect your AI client.
            </p>
          )}
          <a
            href="https://namera.ai/docs/mcp/getting-started"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted underline underline-offset-4 hover:text-foreground"
          >
            Setup guide <HugeiconsIcon aria-hidden icon={LinkSquare02Icon} size={15} />
          </a>
        </div>
        {!complete ? (
          <p className="text-xs leading-relaxed text-muted">
            This step completes when your AI client first connects to Namera.
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
      <p className="text-xs leading-relaxed text-muted">
        A message signature doesn’t send funds. A transaction counts once it’s confirmed onchain.
      </p>
      <Link to="/session-keys" className={secondaryLink}>
        Check session permissions
      </Link>
    </div>
  );
}
