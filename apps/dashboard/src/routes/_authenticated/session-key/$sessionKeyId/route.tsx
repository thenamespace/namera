import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";

import { Schema } from "effect";

import { SessionKeyId, SessionKeyNotFoundError } from "@namera-ai/protocol";

import { prefetchQuery } from "@/atoms/prefetch";
import { sessionKeyAtom } from "@/atoms/session-key";

import { SessionKeyShell } from "../-components/session-key-shell";

export const Route = createFileRoute("/_authenticated/session-key/$sessionKeyId")({
  loader: async ({ abortController, context, params }) => {
    if (!Schema.is(SessionKeyId)(params.sessionKeyId)) throw notFound();

    try {
      const sessionKey = await prefetchQuery(
        context.atomRegistry,
        sessionKeyAtom(params.sessionKeyId),
        abortController.signal,
      );
      return { sessionKey };
    } catch (error) {
      if (Schema.is(SessionKeyNotFoundError)(error)) throw notFound();
      throw error;
    }
  },
  component: SessionKeyLayout,
});

function SessionKeyLayout() {
  const { sessionKey } = Route.useLoaderData();
  return (
    <SessionKeyShell sessionKey={sessionKey}>
      <Outlet />
    </SessionKeyShell>
  );
}
