import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "../-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="Session Keys" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/session-keys/")({
  component: Page,
});
