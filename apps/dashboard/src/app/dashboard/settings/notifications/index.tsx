import { createFileRoute } from "@tanstack/react-router";

import { queries } from "@/lib/query";

import { NotificationsForm } from "../-components";

const NotificationsPage = () => {
  return (
    <div>
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <NotificationsForm />
      </div>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/settings/notifications/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(queries.userPreference.get);
  },
  component: NotificationsPage,
});
