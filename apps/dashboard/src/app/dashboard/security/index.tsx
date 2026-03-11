import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "../-components";

const SecurityPage = () => {
  return (
    <div>
      <PageHeader header="Security" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/security/")({
  component: SecurityPage,
});
