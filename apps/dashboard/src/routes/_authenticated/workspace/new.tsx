import { createFileRoute } from "@tanstack/react-router";

import { HeadingGroup } from "@/components/heading-group";

import { CreateWorkspaceForm } from "./-components/create-workspace-form";

export const Route = createFileRoute("/_authenticated/workspace/new")({
  component: CreateWorkspacePage,
});

function CreateWorkspacePage() {
  return (
    <main className="bg-background flex min-h-screen justify-center px-4 py-12 sm:px-6 relative">
      <div className="w-full max-w-xl absolute top-1/5">
        <HeadingGroup className="mb-6">
          <HeadingGroup.Title level={1} size="lg">
            Create a workspace
          </HeadingGroup.Title>
          <HeadingGroup.Description>
            Create a workspace for your team and wallets.
          </HeadingGroup.Description>
        </HeadingGroup>
        <CreateWorkspaceForm />
      </div>
    </main>
  );
}
