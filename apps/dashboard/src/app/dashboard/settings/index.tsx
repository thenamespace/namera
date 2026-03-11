import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "../-components";

const SettingsPage = () => {
  return (
    <div>
      <PageHeader header="Settings" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/settings/")({
  component: SettingsPage,
});
