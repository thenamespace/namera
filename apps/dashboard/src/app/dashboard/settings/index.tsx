import { createFileRoute, redirect } from "@tanstack/react-router";

import { PageHeader } from "../-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="Settings" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/settings/")({
  component: Page,
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/settings/profile" });
  },
});
