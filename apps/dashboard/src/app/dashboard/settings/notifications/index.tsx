import { createFileRoute } from "@tanstack/react-router";

import { coreAtoms, ensureAtomData } from "@/lib/atom";

import { NotificationsForm } from "../-components";

const NotificationsPage = () => {
  return (
    <div>
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <NotificationsForm />
      </div>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/settings/notifications/")({
  loader: async ({ context }) => {
    await ensureAtomData(context.atomRegistry, coreAtoms.userPreferences.get);
  },
  component: NotificationsPage,
});
