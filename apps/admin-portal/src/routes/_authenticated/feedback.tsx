import { createFileRoute } from "@tanstack/react-router";

import { feedbackAtom } from "@/atoms/feedback";
import { prefetchAuthorizedQuery } from "@/atoms/prefetch";
import { AdminPage } from "@/components/page";
import { PermissionGuard, readFeedbackPermission } from "@/components/permission";

import { FeedbackTable } from "./-components/feedback/table";

const noAccess = <p className="text-muted text-sm">You do not have access to feedback.</p>;

export const Route = createFileRoute("/_authenticated/feedback")({
  loader: async ({ context, abortController }) => {
    await prefetchAuthorizedQuery(
      context.atomRegistry,
      readFeedbackPermission,
      () => feedbackAtom(),
      abortController.signal,
    );
  },
  component: () => (
    <AdminPage title="Feedback">
      <PermissionGuard required={readFeedbackPermission} fallback={noAccess}>
        <FeedbackTable />
      </PermissionGuard>
    </AdminPage>
  ),
});
