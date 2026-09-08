import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";

import { Schema } from "effect";

import { SessionKeyId } from "@namera-ai/protocol";

import { startPrefetchQuery } from "@/atoms/prefetch";
import { sessionKeyAtom } from "@/atoms/session-key";
import { DataError } from "@/components/data-error";
import { useSessionKey } from "@/hooks/session-key";

import { SessionKeyShell } from "../-components/session-key-shell";

export const Route = createFileRoute("/_authenticated/session-key/$sessionKeyId")({
  loader: ({ abortController, context, params }) => {
    if (!Schema.is(SessionKeyId)(params.sessionKeyId)) throw notFound();

    startPrefetchQuery(
      context.atomRegistry,
      sessionKeyAtom(params.sessionKeyId),
      abortController.signal,
    );
    return { sessionKeyId: params.sessionKeyId };
  },
  component: SessionKeyLayout,
});

function SessionKeyLayout() {
  const { sessionKeyId } = Route.useLoaderData();
  const sessionKey = useSessionKey(sessionKeyId);
  return (
    <SessionKeyShell sessionKey={sessionKey.data}>
      {sessionKey.isError ? (
        <DataError
          label="session key"
          onRetry={sessionKey.refetch}
          isRetrying={sessionKey.isFetching}
        />
      ) : (
        <Outlet />
      )}
    </SessionKeyShell>
  );
}
