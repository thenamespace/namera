import { createFileRoute } from "@tanstack/react-router";

import { Card, Chip, Typography } from "@namera-ai/ui";
import { CheckmarkCircle02Icon, HugeiconsIcon, Key01Icon, Wallet02Icon } from "@namera-ai/ui/icons";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const currentActor = Route.parentRoute.useLoaderData();
  const displayName = currentActor.user.metadata.name ?? currentActor.user.email.split("@")[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Typography.Paragraph color="muted" size="sm">
            {currentActor.organization.metadata.name}
          </Typography.Paragraph>
          <Typography.Heading className="mt-1 text-balance" level={1}>
            Welcome, {displayName}
          </Typography.Heading>
          <Typography.Paragraph className="mt-3 max-w-2xl text-pretty" color="muted">
            Your Namera workspace is ready. Wallet and policy controls will appear here as they
            become available.
          </Typography.Paragraph>
        </div>
        <Chip color="success" variant="soft">
          <Chip.Label className="flex items-center gap-1.5">
            <HugeiconsIcon aria-hidden="true" icon={CheckmarkCircle02Icon} size={15} />
            Workspace active
          </Chip.Label>
        </Chip>
      </div>

      <section className="mt-10" aria-labelledby="workspace-status">
        <Typography.Heading id="workspace-status" level={2}>
          Workspace Status
        </Typography.Heading>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Card>
            <Card.Header>
              <span className="bg-success-soft text-success-soft-foreground grid size-10 place-items-center rounded-lg">
                <HugeiconsIcon aria-hidden="true" icon={CheckmarkCircle02Icon} size={20} />
              </span>
            </Card.Header>
            <Card.Content>
              <Card.Title>Identity Verified</Card.Title>
              <Card.Description className="mt-2 break-words">
                {currentActor.user.email}
              </Card.Description>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <span className="bg-accent-soft text-accent-soft-foreground grid size-10 place-items-center rounded-lg">
                <HugeiconsIcon aria-hidden="true" icon={Key01Icon} size={20} />
              </span>
            </Card.Header>
            <Card.Content>
              <Card.Title>{currentActor.role.metadata.name}</Card.Title>
              <Card.Description className="mt-2">
                {currentActor.role.permissions.length} workspace permissions
              </Card.Description>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <span className="bg-default text-default-foreground grid size-10 place-items-center rounded-lg">
                <HugeiconsIcon aria-hidden="true" icon={Wallet02Icon} size={20} />
              </span>
            </Card.Header>
            <Card.Content>
              <div className="flex items-center justify-between gap-3">
                <Card.Title>Wallets</Card.Title>
                <Chip size="sm" variant="soft">
                  <Chip.Label>Coming soon</Chip.Label>
                </Chip>
              </div>
              <Card.Description className="mt-2">
                Smart-account creation and policy controls are the next workspace capability.
              </Card.Description>
            </Card.Content>
          </Card>
        </div>
      </section>

      <Card className="mt-6" variant="secondary">
        <Card.Content className="grid gap-8 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <Typography.Heading level={2}>Built for delegated execution</Typography.Heading>
            <Typography.Paragraph className="mt-2 max-w-2xl text-pretty" color="muted">
              Your organization is the trust boundary. Future API keys, MCP clients, and CLI
              sessions will receive explicit grants before they can access a wallet.
            </Typography.Paragraph>
          </div>
          <div className="bg-background-secondary flex items-center gap-3 rounded-xl border border-separator px-4 py-3">
            <HugeiconsIcon aria-hidden="true" icon={Key01Icon} size={20} />
            <div>
              <Typography.Paragraph size="sm" weight="medium">
                Session-bound access
              </Typography.Paragraph>
              <Typography.Paragraph color="muted" size="xs">
                Least privilege by default
              </Typography.Paragraph>
            </div>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
