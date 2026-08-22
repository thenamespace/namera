import { createFileRoute } from "@tanstack/react-router";

import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

export const Route = createFileRoute("/_authenticated/inbox")({
  component: InboxPage,
});

function InboxPage() {
  return (
    <DashboardPage>
      <DashboardPage.Header>
        <DashboardPage.Title>
          <HeadingGroup.Title className="text-sm" level={1} weight="normal">
            Inbox
          </HeadingGroup.Title>
        </DashboardPage.Title>
      </DashboardPage.Header>
      <DashboardPage.Content />
    </DashboardPage>
  );
}
