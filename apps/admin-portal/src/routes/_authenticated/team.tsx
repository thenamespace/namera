import { createFileRoute } from "@tanstack/react-router";

import { AdminPage } from "@/components/page";

export const Route = createFileRoute("/_authenticated/team")({
  component: () => <AdminPage title="Team" />,
});
