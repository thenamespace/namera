import { createFileRoute } from "@tanstack/react-router";

import { currentAdminAtom } from "@/atoms/auth";
import { feedbackAtom } from "@/atoms/feedback";
import { prefetchQuery } from "@/atoms/prefetch";
import { AdminPage } from "@/components/page";
import { hasPermissions, PermissionGuard, readFeedbackPermission } from "@/components/permission";

import { FeedbackTable } from "./-components/feedback/table";

const noAccess = <p className="text-muted text-sm">You do not have access to feedback.</p>;

export const Route = createFileRoute("/_authenticated/feedback")({
  loader: async ({ context, abortController }) => {
    const access = await prefetchQuery(
      context.atomRegistry,
      currentAdminAtom,
      abortController.signal,
    );
    if (
      access.status === "authorized" &&
      hasPermissions(access.admin.permissions, readFeedbackPermission)
    ) {
      await prefetchQuery(context.atomRegistry, feedbackAtom(), abortController.signal);
    }
  },
  component: () => (
    <AdminPage title="Feedback">
      <PermissionGuard required={readFeedbackPermission} fallback={noAccess}>
        <FeedbackTable />
      </PermissionGuard>
    </AdminPage>
  ),
});
