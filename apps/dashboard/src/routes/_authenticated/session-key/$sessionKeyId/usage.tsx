import { createFileRoute, notFound } from "@tanstack/react-router";

import { Schema } from "effect";

import { SessionKeyId } from "@namera-ai/protocol";

import { sessionKeyExecutionsAtom } from "@/atoms/execution";
import { startPrefetchQuery } from "@/atoms/prefetch";
import { SessionKeyExecutionsTable } from "@/components/executions-table";

export const Route = createFileRoute("/_authenticated/session-key/$sessionKeyId/usage")({
  loader: ({ abortController, context, params }) => {
    if (!Schema.is(SessionKeyId)(params.sessionKeyId)) throw notFound();

    startPrefetchQuery(
      context.atomRegistry,
      sessionKeyExecutionsAtom(params.sessionKeyId),
      abortController.signal,
    );
    return { sessionKeyId: params.sessionKeyId };
  },
  component: SessionKeyUsagePage,
});

function SessionKeyUsagePage() {
  const { sessionKeyId } = Route.useLoaderData();
  return <SessionKeyExecutionsTable sessionKeyId={sessionKeyId} />;
}
