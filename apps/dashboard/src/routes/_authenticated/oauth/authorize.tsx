import { createFileRoute, redirect } from "@tanstack/react-router";

import { Schema } from "effect";

import { OAuthAuthorizationRequestError, OAuthAuthorizationRequestId } from "@namera-ai/protocol";
import { Typography } from "@namera-ai/ui";

import { oauthAuthorizationRequestAtom } from "@/atoms/auth/oauth";
import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { sessionKeysAtom } from "@/atoms/session-key";
import { hasPermissions } from "@/components/permission";

import { OAuthConsentForm } from "./-components/oauth-consent-form";

const oauthCreatePermission = ["mcp-authorization:create"] as const;

export const Route = createFileRoute("/_authenticated/oauth/authorize")({
  validateSearch: (search): { requestId?: OAuthAuthorizationRequestId } =>
    Schema.is(OAuthAuthorizationRequestId)(search.requestId) ? { requestId: search.requestId } : {},
  loaderDeps: ({ search }) => ({ requestId: search.requestId }),
  loader: async ({ abortController, context, deps }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });

    const canAuthorize = hasPermissions(currentUser.role.permissions, oauthCreatePermission);
    if (deps.requestId === undefined) {
      return { canAuthorize, currentUser, request: null, sessionKeys: [] };
    }

    try {
      const request = await prefetchQuery(
        context.atomRegistry,
        oauthAuthorizationRequestAtom(deps.requestId),
        abortController.signal,
      );
      const sessionKeys = canAuthorize
        ? await prefetchQuery(context.atomRegistry, sessionKeysAtom, abortController.signal)
        : [];
      return { canAuthorize, currentUser, request, sessionKeys };
    } catch (error) {
      if (Schema.is(OAuthAuthorizationRequestError)(error)) {
        return { canAuthorize, currentUser, request: null, sessionKeys: [] };
      }
      throw error;
    }
  },
  component: OAuthAuthorizePage,
});

function OAuthAuthorizePage() {
  const { canAuthorize, currentUser, request, sessionKeys } = Route.useLoaderData();

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-lg">
        {request === null ? (
          <div className="text-center flex flex-col items-center justify-center">
            <Typography.Heading className="text-xl" level={1} weight="medium">
              Authorization request unavailable
            </Typography.Heading>
            <Typography.Paragraph className="mt-2" color="muted" size="sm">
              This request is invalid, expired, or has already been used.
            </Typography.Paragraph>
          </div>
        ) : (
          <OAuthConsentForm
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
