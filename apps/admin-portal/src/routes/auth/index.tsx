import { createFileRoute, redirect } from "@tanstack/react-router";

import { Schema } from "effect";

import { GoogleAuthError } from "@namera-ai/protocol";

import { currentAdminAtom } from "@/atoms/auth";
import { prefetchQuery } from "@/atoms/prefetch";

import { AuthForm } from "./-components/auth-form";

export const Route = createFileRoute("/auth/")({
  validateSearch: (search): { google?: string; denied?: boolean } => ({
    ...(Schema.is(GoogleAuthError.fields.code)(search.google) ? { google: search.google } : {}),
    ...(search.denied === true || search.denied === "true" ? { denied: true } : {}),
  }),
  loader: async ({ context, abortController }) => {
    context.atomRegistry.refresh(currentAdminAtom);
    const access = await prefetchQuery(
      context.atomRegistry,
      currentAdminAtom,
      abortController.signal,
    );
    if (access.status === "authorized") throw redirect({ to: "/", replace: true });
    return access;
  },
  component: AuthPage,
});

function AuthPage() {
  const access = Route.useLoaderData();
  const search = Route.useSearch();
  return (
    <AuthForm
      denied={access.status === "denied" || search.denied === true}
      google={search.google}
    />
  );
}
