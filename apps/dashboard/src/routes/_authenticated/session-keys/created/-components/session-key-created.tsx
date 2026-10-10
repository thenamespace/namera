// oxlint-disable react-perf/jsx-no-new-object-as-prop
import { useState, type ReactNode } from "react";

import { Link } from "@tanstack/react-router";

import type { SessionKeyResponse } from "@namera-ai/protocol/dto";
import { Button, IconPreview, Modal, Typography, buttonVariants } from "@namera-ai/ui";
import {
  ApiIcon,
  ArrowRight01Icon,
  BotIcon,
  Globe02Icon,
  HugeiconsIcon,
  CommandLineIcon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import {
  ChainDisplay,
  MetadataDisplay,
  NamespaceDisplay,
  SessionKeyStatusDisplay,
} from "@/components/display";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { hasPermissions } from "@/components/permission";
import { useCurrentUser } from "@/hooks/auth";

import { CommandBlock } from "../../-components/create-session-key-form/command-block";

const actions = [
  {
    title: "Connect MCP",
    description: "Connect your agent to Namera using your imported local key.",
    icon: BotIcon,
    to: "/settings/workspace/mcp",
    permissions: ["mcp-authorization:read"],
  },
  {
    title: "Create API key",
    description: "Give your integration API access scoped to this session key.",
    icon: ApiIcon,
    to: "/settings/workspace/api-keys",
    permissions: ["api-key:read", "api-key:create"],
  },
] as const;

const actionClassName = buttonVariants({
  variant: "ghost",
  className:
    "h-auto min-h-16 w-full justify-start gap-3 rounded-lg bg-default/40 px-3 py-3 text-left whitespace-normal transition-colors hover:bg-default/80",
});

function ActionContent({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: typeof BotIcon;
}) {
  return (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface/60">
        <HugeiconsIcon aria-hidden className="size-4 text-muted" icon={icon} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span>{title}</span>
        <span className="text-xs font-normal text-muted">{description}</span>
      </span>
      <HugeiconsIcon
        aria-hidden
        className="ml-auto size-4 shrink-0 text-muted"
        icon={ArrowRight01Icon}
      />
    </>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[minmax(7rem,0.42fr)_minmax(0,1fr)] items-center gap-5 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <Typography className="text-sm!" color="muted" weight="normal">
        {label}
      </Typography>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

export function SessionKeyCreated({ sessionKey }: { sessionKey: SessionKeyResponse }) {
  const [cliOpen, setCliOpen] = useState(false);
  const openCli = useEventCallback(() => setCliOpen(true));
  const user = useCurrentUser();
  const permissions = user.data?.role.permissions ?? [];
  const availableActions = actions.filter((action) =>
    hasPermissions(permissions, action.permissions),
  );
  const installed = sessionKey.installations.filter(
    (network) => network.status === "installed",
  ).length;
  const needsApproval =
    sessionKey.status === "pending" ||
    (sessionKey.status === "active" && installed < sessionKey.installations.length);
  const canApprove = hasPermissions(permissions, ["session-key:create"]);
  const canConnectCli = hasPermissions(permissions, ["cli-authorization:create"]);

  return (
    <DashboardPage>
      <DashboardPage.Content className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 md:py-16">
        <div className="mx-auto w-full py-4 sm:px-2 sm:py-8">
          <header className="flex flex-col items-start">
            <IconPreview
              className="shrink-0 shadow-sm"
              size="lg"
              value={sessionKey.metadata.logo ?? { type: "emoji", value: "🔑" }}
            />
            <Typography.Heading
              className="mt-3 max-w-full truncate text-3xl tracking-tight"
              level={1}
            >
              {sessionKey.metadata.name}
            </Typography.Heading>
            {sessionKey.metadata.description ? (
              <Typography.Paragraph className="mt-2 max-w-2xl text-muted" size="sm">
                {sessionKey.metadata.description}
              </Typography.Paragraph>
            ) : null}
          </header>
          <section aria-labelledby="created-session-properties" className="mt-10">
            <Typography.Heading
              className="mb-4 text-sm text-muted"
              id="created-session-properties"
              level={2}
              weight="medium"
            >
              Properties
            </Typography.Heading>
            <div className="grid gap-2">
              <Property label="Status">
                <SessionKeyStatusDisplay status={sessionKey.status} />
              </Property>
              <Property label="Account">
                <MetadataDisplay
                  fallbackName="Unnamed account"
                  metadata={sessionKey.wallet.metadata}
                />
              </Property>
              <Property label="Namespace">
                <NamespaceDisplay namespace={sessionKey.namespace} />
              </Property>
              <Property label="Networks">
                <div className="grid gap-2">
                  {sessionKey.installations.map((network) => (
                    <ChainDisplay key={network.chainId} chainId={network.chainId} />
                  ))}
                </div>
              </Property>
            </div>
          </section>
        </div>
        <section className="mt-6">
          <HeadingGroup.Title className="mb-3" size="sm">
            Next steps
          </HeadingGroup.Title>
          {sessionKey.status === "pending" ? (
            <Typography.Paragraph className="mb-3" color="muted" size="sm">
              Your key is registered. Enable at least one network before using it with MCP or an API
              key.
            </Typography.Paragraph>
          ) : null}
          <div className="grid gap-2">
            {needsApproval && canApprove ? (
              <Link
                className={actionClassName}
                to="/session-key/$sessionKeyId/overview"
                params={{ sessionKeyId: sessionKey.id }}
              >
                <ActionContent
                  icon={Globe02Icon}
                  title="Enable networks"
                  description="Approve network access with your account owner."
                />
              </Link>
            ) : null}
            {availableActions.map((action) => (
              <Link key={action.to} className={actionClassName} to={action.to}>
                <ActionContent {...action} />
              </Link>
            ))}
            {canConnectCli ? (
              <Button className={actionClassName} onPress={openCli}>
                <ActionContent
                  icon={CommandLineIcon}
                  title="Connect CLI"
                  description="Authorize your terminal to use your imported session key."
                />
              </Button>
            ) : null}
            {availableActions.length === 0 && !canConnectCli ? (
              <Typography.Paragraph color="muted" size="sm">
                Ask a workspace admin to help connect your agent.
              </Typography.Paragraph>
            ) : null}
          </div>
        </section>
        <Link
          className={buttonVariants({ variant: "tertiary", size: "sm", className: "mt-6" })}
          to="/session-key/$sessionKeyId/overview"
          params={{ sessionKeyId: sessionKey.id }}
        >
          View session key
        </Link>
      </DashboardPage.Content>
      <Modal isOpen={cliOpen} onOpenChange={setCliOpen}>
        <Modal.Backdrop>
          <Modal.Container size="lg">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Connect CLI</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="grid gap-3">
                <Typography.Paragraph color="muted" size="sm">
                  {sessionKey.status === "active"
                    ? "Install the CLI, then log in and select your session key in the browser."
                    : "Enable at least one network first. Then install the CLI, log in, and select your session key in the browser."}
                </Typography.Paragraph>
                <div className="grid gap-1">
                  <Typography weight="medium" className="text-sm!">
                    1. Install the CLI
                  </Typography>
                  <CommandBlock
                    className="my-0 border border-separator bg-background"
                    command="npm i -g @namera-ai/cli@latest"
                    label="Install CLI command"
                  />
                </div>
                <div className="grid gap-1">
                  <Typography weight="medium" className="text-sm!">
                    2. Log in
                  </Typography>
                  <CommandBlock
                    className="my-0 border border-separator bg-background"
                    command="namera login"
                    label="Log in command"
                  />
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </DashboardPage>
  );
}
