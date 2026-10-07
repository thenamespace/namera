import { createFileRoute, redirect } from "@tanstack/react-router";

import { Schema } from "effect";

import { GoogleAuthError } from "@namera-ai/protocol";
import { Typography } from "@namera-ai/ui";

import { connectedAccountsAtom, googleConfigurationAtom } from "@/atoms/auth/google";
import { currentUserAtom, sessionsAtom } from "@/atoms/auth/session";
import { prefetchQuery, startPrefetchQuery } from "@/atoms/prefetch";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { getErrorMessage } from "@/lib/error-messages";

import { ConnectedAccounts } from "./-components/connected-accounts";
import { SecuritySessions } from "./-components/security-sessions";

export const Route = createFileRoute("/_authenticated/settings/security")({
  validateSearch: (search): { google?: string } =>
    search.google === "linked" || Schema.is(GoogleAuthError.fields.code)(search.google)
      ? { google: search.google }
      : {},
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });
    startPrefetchQuery(context.atomRegistry, sessionsAtom, abortController.signal);
    startPrefetchQuery(context.atomRegistry, connectedAccountsAtom, abortController.signal);
    startPrefetchQuery(context.atomRegistry, googleConfigurationAtom, abortController.signal);
    return { currentUser };
  },
  component: SecurityPage,
});

function SecurityPage() {
  const { currentUser } = Route.useLoaderData();
  const { google } = Route.useSearch();

  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 md:py-16">
        <HeadingGroup className="mb-10">
          <HeadingGroup.Title level={1} size="lg">
            Security
          </HeadingGroup.Title>
        </HeadingGroup>
        {google && google !== "linked" ? (
          <Typography.Paragraph aria-live="polite" className="mb-4" size="sm">
            {
              getErrorMessage(
                { _tag: "GoogleAuthError", code: google },
                { title: "Couldn’t connect Google" },
              ).description
            }
          </Typography.Paragraph>
        ) : null}
        <ConnectedAccounts signedInAt={currentUser.session.createdAt} outcome={google} />
        <SecuritySessions currentSessionId={currentUser.session.id} />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
