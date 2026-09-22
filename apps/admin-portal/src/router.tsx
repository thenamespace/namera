import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { Button, Typography } from "@namera-ai/ui";

import { DataLoading } from "@/components/data-states";
import { routeTree } from "@/routeTree.gen";

function RouterPending() {
  return <DataLoading label="Loading page" />;
}

function RouterError({ reset }: { readonly reset: () => void }) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-start gap-3 px-4 py-20">
      <div role="alert">
        <Typography.Heading level={1} className="text-base" weight="medium">
          This screen failed to render
        </Typography.Heading>
        <Typography.Paragraph color="muted" size="sm">
          Reloading the screen usually clears it. If it persists, check the API is reachable.
        </Typography.Paragraph>
      </div>
      <Button variant="tertiary" onPress={reset}>
        Reload this screen
      </Button>
    </section>
  );
}

function RouterNotFound() {
  return (
    <section className="mx-auto flex max-w-md flex-col gap-2 px-4 py-20">
      <Typography.Heading level={1} className="text-base" weight="medium">
        No such screen
      </Typography.Heading>
      <Typography.Paragraph color="muted" size="sm">
        The portal has invites, users, and the waitlist. Pick one from the navigation.
      </Typography.Paragraph>
    </section>
  );
}

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPendingComponent: RouterPending,
    defaultErrorComponent: RouterError,
    defaultNotFoundComponent: RouterNotFound,
    defaultPendingMinMs: 250,
    defaultPendingMs: 150,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
