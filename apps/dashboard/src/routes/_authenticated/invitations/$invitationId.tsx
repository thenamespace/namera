import { createFileRoute, redirect } from "@tanstack/react-router";

import { Schema } from "effect";

import {
  InvitationId,
  InvitationNotFoundError,
  InvitationRecipientMismatchError,
} from "@namera-ai/protocol";
import { MagicLinkReturnTo } from "@namera-ai/protocol/dto";

import { invitationAtom } from "@/atoms/auth/invitation";
import { currentUserAtom, logoutMutation } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { QueryKeys } from "@/atoms/query-keys";

import { InvitationPage } from "./-components/invitation-page";

export const Route = createFileRoute("/_authenticated/invitations/$invitationId")({
  loader: async ({ abortController, context, params }) => {
    const returnTo = Schema.decodeSync(MagicLinkReturnTo)(`/invitations/${params.invitationId}`);
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );

    if (currentUser === null) {
      throw redirect({ to: "/auth", search: { returnTo }, replace: true });
    }

    if (!Schema.is(InvitationId)(params.invitationId)) {
      return { invitation: null };
    }

    let recipientMismatch = false;
    let invitation = null;

    try {
      invitation = await prefetchQuery(
        context.atomRegistry,
        invitationAtom(params.invitationId),
        abortController.signal,
      );
    } catch (error) {
      if (Schema.is(InvitationRecipientMismatchError)(error)) {
        recipientMismatch = true;
      } else if (!Schema.is(InvitationNotFoundError)(error)) {
        throw error;
      }
    }

    if (invitation !== null && invitation.invitation.email !== currentUser.user.email) {
      recipientMismatch = true;
    }

    if (recipientMismatch) {
      context.atomRegistry.set(logoutMutation, {
        reactivityKeys: [
          ...QueryKeys.session.current,
          ...QueryKeys.session.lists,
          ...QueryKeys.organization.active,
        ],
      });
      await prefetchQuery(context.atomRegistry, logoutMutation, abortController.signal);
      throw redirect({ to: "/auth", search: { returnTo }, replace: true });
    }

    return { invitation };
  },
  component: InvitationRoute,
});

function InvitationRoute() {
  const { invitation } = Route.useLoaderData();
  return <InvitationPage initialInvitation={invitation} />;
}
