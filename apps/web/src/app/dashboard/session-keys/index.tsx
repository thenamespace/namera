import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "../-components";

const SessionKeysPage = () => {
  return (
    <div>
      <PageHeader header="Session Keys" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/session-keys/")({
  component: SessionKeysPage,
});
