import { createFileRoute } from "@tanstack/react-router";

import { NewWorkspaceForm } from "./-components";

const NewWorkspacePage = () => {
  return (
    <div className="min-h-screen bg-[linear-gradient(lch(4.52_0.3_272)_0%,lch(1.82_0_272)_50%)]">
      <div className="mx-auto w-full max-w-xl px-4 py-[20dvh]">
        <NewWorkspaceForm />
      </div>
    </div>
  );
};

export const Route = createFileRoute("/workspace/new")({
  component: NewWorkspacePage,
});
