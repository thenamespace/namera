import { createFileRoute, notFound } from "@tanstack/react-router";

import { Schema } from "effect";

import { SessionKeyId } from "@namera-ai/protocol";

import { prefetchQuery } from "@/atoms/prefetch";
import { sessionKeyAtom } from "@/atoms/session-key";
import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import { useSessionKey } from "@/hooks/session-key";

import { SessionKeyCreated } from "./-components/session-key-created";

export const Route = createFileRoute("/_authenticated/session-keys/created/$sessionKeyId")({
  loader: async ({ context, params, abortController }) => {
    if (!Schema.is(SessionKeyId)(params.sessionKeyId)) throw notFound();
    await prefetchQuery(
      context.atomRegistry,
      sessionKeyAtom(params.sessionKeyId),
      abortController.signal,
    );
    return { sessionKeyId: params.sessionKeyId };
  },
  component: SessionKeyCreatedPage,
});

function SessionKeyCreatedPage() {
  const { sessionKeyId } = Route.useLoaderData();
  const sessionKey = useSessionKey(sessionKeyId);
  if (sessionKey.isError)
    return (
      <DataError
        label="session key"
        onRetry={sessionKey.refetch}
        isRetrying={sessionKey.isFetching}
      />
    );
  return sessionKey.data ? (
    <SessionKeyCreated sessionKey={sessionKey.data} />
  ) : (
    <DataLoading label="Loading session key" />
  );
}
