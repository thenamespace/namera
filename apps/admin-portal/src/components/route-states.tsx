import { useCallback } from "react";

import { useRouter } from "@tanstack/react-router";

import { Button, Typography } from "@namera-ai/ui";

export function RouteLoading() {
  return (
    <main className="min-h-screen grid place-items-center">
      <output>Checking your access...</output>
    </main>
  );
}

export function RouteError() {
  const router = useRouter();
  const retry = useCallback(() => {
    void router.invalidate();
  }, [router]);
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <Typography.Heading level={1} className="text-xl">
        Couldn’t connect to Namera
      </Typography.Heading>
      <Typography.Paragraph color="muted" role="alert">
        Check your connection and try again.
      </Typography.Paragraph>
      <Button onPress={retry}>Try again</Button>
    </main>
  );
}

export function RouteNotFound() {
  return (
    <main className="min-h-screen grid place-items-center">
      <a href="/auth">Back to login</a>
    </main>
  );
}
