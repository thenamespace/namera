import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "../-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="MCP" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/mcp/")({
  component: Page,
});
