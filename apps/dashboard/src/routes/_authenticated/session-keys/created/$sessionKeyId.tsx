import { createFileRoute, notFound } from "@tanstack/react-router";

import { Schema } from "effect";

import { SessionKeyId } from "@namera-ai/protocol";

import { prefetchQuery } from "@/atoms/prefetch";
import { sessionKeyAtom } from "@/atoms/session-key";
import { DataError } from "@/components/data-error";
import { DataLoading } from "@/components/data-loading";
import { SessionKeyCreated } from "@/components/session-key-creation/created";
import { useSessionKey } from "@/hooks/session-key";

import { validateSessionCreationSource } from "../-components/creation-search";

export const Route = createFileRoute("/_authenticated/session-keys/created/$sessionKeyId")({
  validateSearch: validateSessionCreationSource,
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
  const { from } = Route.useSearch();
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
    <SessionKeyCreated sessionKey={sessionKey.data} onboarding={from === "get-started"} />
  ) : (
    <DataLoading label="Loading session key" />
  );
}
