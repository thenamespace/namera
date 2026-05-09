import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/app/dashboard/-components";

const Page = () => {
  return (
    <div>
      <PageHeader header="MCP" />
    </div>
  );
};

export const Route = createFileRoute("/dashboard/(agents)/mcp/")({
  component: Page,
});
