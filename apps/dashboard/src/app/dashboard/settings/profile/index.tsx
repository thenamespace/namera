import { createFileRoute } from "@tanstack/react-router";

import { Seo } from "@/components/misc";
import { authAtoms, ensureAtomData } from "@/lib/atom";

import { ProfileForm } from "../-components";

const ProfilePage = () => {
  return (
    <div>
      <Seo title="Profile" />
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <ProfileForm />
      </div>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/settings/profile/")({
  loader: async ({ context }) => {
    await ensureAtomData(context.atomRegistry, authAtoms.me);
  },
  component: ProfilePage,
});
