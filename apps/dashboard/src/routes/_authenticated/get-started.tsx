import { createFileRoute } from "@tanstack/react-router";

import { gettingStartedAtom } from "@/atoms/getting-started";

import { GettingStartedPage } from "./-components/getting-started/page";

export const Route = createFileRoute("/_authenticated/get-started")({
  loader: ({ context }) => {
    context.atomRegistry.get(gettingStartedAtom);
  },
  component: GettingStartedPage,
});
