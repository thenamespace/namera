import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { Schema } from "effect";

import { GoogleAuthError } from "@namera-ai/protocol";
import {
  MagicLinkReturnTo,
  BetaInviteCode,
  type MagicLinkReturnTo as MagicLinkReturnToType,
} from "@namera-ai/protocol/dto";

import { googleConfigurationAtom } from "@/atoms/auth/google";
import { currentUserAtom } from "@/atoms/auth/session";
import { startPrefetchQuery } from "@/atoms/prefetch";
import { prefetchQuery } from "@/atoms/prefetch";

export const Route = createFileRoute("/auth")({
  validateSearch: (
    search,
  ): { returnTo?: MagicLinkReturnToType; invite?: string; google?: string } => ({
    ...(Schema.is(GoogleAuthError.fields.code)(search.google) ? { google: search.google } : {}),
    ...(Schema.is(MagicLinkReturnTo)(search.returnTo) ? { returnTo: search.returnTo } : {}),
    ...(typeof search.invite === "string" &&
    Schema.is(BetaInviteCode)(search.invite.trim().toUpperCase())
      ? { invite: search.invite.trim().toUpperCase() }
      : {}),
  }),
  loaderDeps: ({ search }) => ({ returnTo: search.returnTo }),
  loader: async ({ abortController, context, deps }) => {
    startPrefetchQuery(context.atomRegistry, googleConfigurationAtom, abortController.signal);
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
