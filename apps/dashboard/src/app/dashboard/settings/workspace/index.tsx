import { createFileRoute } from "@tanstack/react-router";

import { Seo } from "@/components/misc";

import { WorkspaceUpdateForm } from "../-components";

const WorkspacePage = () => {
  return (
    <div>
      <Seo title="Workspace" />
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <WorkspaceUpdateForm />
      </div>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/settings/workspace/")({
  component: WorkspacePage,
});
