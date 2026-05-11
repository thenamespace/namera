import { createFileRoute } from "@tanstack/react-router";

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
  component: NotificationsPage,
});
