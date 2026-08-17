import { createFileRoute, redirect } from "@tanstack/react-router";

import { Schema } from "effect";

import { OAuthDeviceAuthorizationError } from "@namera-ai/protocol";
import { Typography } from "@namera-ai/ui";

import { oauthDeviceAuthorizationAtom } from "@/atoms/auth/oauth";
import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { sessionKeysAtom } from "@/atoms/session-key";
import { hasPermissions } from "@/components/permission";

import { CliConsentForm } from "./-components/cli-consent-form";

const cliCreatePermission = ["cli-authorization:create"] as const;

export const Route = createFileRoute("/_authenticated/cli/authorize")({
  validateSearch: (search): { user_code?: string } =>
    typeof search.user_code === "string" ? { user_code: search.user_code } : {},
  loaderDeps: ({ search }) => ({ userCode: search.user_code }),
  loader: async ({ abortController, context, deps }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });

    const canAuthorize = hasPermissions(currentUser.role.permissions, cliCreatePermission);
    if (deps.userCode === undefined) {
      return { canAuthorize, currentUser, request: null, sessionKeys: [] };
    }

    try {
      const request = await prefetchQuery(
        context.atomRegistry,
        oauthDeviceAuthorizationAtom(deps.userCode),
        abortController.signal,
      );
      const sessionKeys = canAuthorize
        ? await prefetchQuery(context.atomRegistry, sessionKeysAtom, abortController.signal)
        : [];
      return { canAuthorize, currentUser, request, sessionKeys };
    } catch (error) {
      if (Schema.is(OAuthDeviceAuthorizationError)(error)) {
        return { canAuthorize, currentUser, request: null, sessionKeys: [] };
      }
      throw error;
    }
  },
  component: CliAuthorizePage,
});

function CliAuthorizePage() {
  const { canAuthorize, currentUser, request, sessionKeys } = Route.useLoaderData();

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-lg">
        {request === null ? (
          <div className="flex flex-col items-center justify-center text-center">
            <Typography.Heading className="text-xl" level={1} weight="medium">
              Authorization request unavailable
            </Typography.Heading>
            <Typography.Paragraph className="mt-2" color="muted" size="sm">
              This CLI request is invalid, expired, or has already been used.
            </Typography.Paragraph>
          </div>
        ) : (
          <CliConsentForm
            canAuthorize={canAuthorize}
            organizationId={currentUser.organization.id}
            request={request}
            sessionKeys={sessionKeys}
          />
        )}
      </div>
    </main>
  );
}
