import { createFileRoute } from "@tanstack/react-router";

import { notificationsAtom, unreadNotificationCountAtom } from "@/atoms/notification";
import { startPrefetchQuery } from "@/atoms/prefetch";

import { Inbox } from "./-components/inbox";

export const Route = createFileRoute("/_authenticated/inbox")({
  loader: ({ abortController, context }) => {
    startPrefetchQuery(context.atomRegistry, notificationsAtom(), abortController.signal);
    startPrefetchQuery(context.atomRegistry, unreadNotificationCountAtom, abortController.signal);
  },
  component: InboxPage,
});

function InboxPage() {
  return <Inbox />;
}
