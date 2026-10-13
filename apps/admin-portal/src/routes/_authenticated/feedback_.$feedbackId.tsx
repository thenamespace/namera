import { createFileRoute, Link } from "@tanstack/react-router";

import { Schema } from "effect";

import { FeedbackId } from "@namera-ai/protocol/model";
import { Button } from "@namera-ai/ui";

import { currentAdminAtom } from "@/atoms/auth";
import { feedbackDetailAtom } from "@/atoms/feedback";
import { prefetchQuery } from "@/atoms/prefetch";
import { AdminPage } from "@/components/page";
import { hasPermissions, PermissionGuard, readFeedbackPermission } from "@/components/permission";
import { useFeedbackDetail } from "@/hooks/feedback";

import { FeedbackDetails } from "./-components/feedback/details";

const noAccess = <p className="text-muted text-sm">You do not have access to feedback.</p>;

export const Route = createFileRoute("/_authenticated/feedback_/$feedbackId")({
  params: {
    parse: (params) => ({ feedbackId: Schema.decodeUnknownSync(FeedbackId)(params.feedbackId) }),
  },
  loader: async ({ context, params, abortController }) => {
    const access = await prefetchQuery(
      context.atomRegistry,
      currentAdminAtom,
      abortController.signal,
    );
    if (
      access.status === "authorized" &&
      hasPermissions(access.admin.permissions, readFeedbackPermission)
    ) {
      await prefetchQuery(
        context.atomRegistry,
        feedbackDetailAtom(params.feedbackId),
        abortController.signal,
      );
    }
  },
  errorComponent: ({ reset }) => (
    <AdminPage title="Feedback">
      <div role="alert" className="grid justify-items-start gap-3 text-sm">
        <p>Couldn’t load this feedback. It may no longer be available.</p>
        <Button variant="tertiary" onPress={reset}>
          Try again
        </Button>
        <Link to="/feedback" className="underline">
          Back to feedback
        </Link>
      </div>
    </AdminPage>
  ),
  component: FeedbackPage,
});

function FeedbackPage() {
  const { feedbackId } = Route.useParams();
  const feedback = useFeedbackDetail(feedbackId);
  return (
    <AdminPage title="Feedback">
      <PermissionGuard required={readFeedbackPermission} fallback={noAccess}>
        {feedback.error ? (
          <div role="alert" className="grid justify-items-start gap-3 text-sm">
            <p>Couldn’t load this feedback.</p>
            <Button variant="tertiary" onPress={feedback.refetch}>
              Try again
            </Button>
          </div>
        ) : feedback.data ? (
          <FeedbackDetails entry={feedback.data} />
        ) : (
          <output>Loading feedback…</output>
        )}
      </PermissionGuard>
    </AdminPage>
  );
}
