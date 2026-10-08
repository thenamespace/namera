import { createFileRoute } from "@tanstack/react-router";

import { AdminPage } from "@/components/page";

export const Route = createFileRoute("/_authenticated/waitlist")({
  component: () => <AdminPage title="Waitlist" />,
});
