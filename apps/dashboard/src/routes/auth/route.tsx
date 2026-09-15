import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { Schema } from "effect";

import {
  MagicLinkReturnTo,
  BetaInviteCode,
  type MagicLinkReturnTo as MagicLinkReturnToType,
} from "@namera-ai/protocol/dto";

import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";

export const Route = createFileRoute("/auth")({
  validateSearch: (search): { returnTo?: MagicLinkReturnToType; invite?: string } => ({
    ...(Schema.is(MagicLinkReturnTo)(search.returnTo) ? { returnTo: search.returnTo } : {}),
    ...(typeof search.invite === "string" &&
    Schema.is(BetaInviteCode)(search.invite.trim().toUpperCase())
      ? { invite: search.invite.trim().toUpperCase() }
      : {}),
  }),
  loaderDeps: ({ search }) => ({ returnTo: search.returnTo }),
  loader: async ({ abortController, context, deps }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );

    if (currentUser !== null) {
      throw redirect({ href: deps.returnTo ?? "/", replace: true });
    }
  },
  component: Outlet,
});
