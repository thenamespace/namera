import { createFileRoute } from "@tanstack/react-router";

import { Seo } from "@/components/misc";
import { queries } from "@/lib/query";

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
    await context.queryClient.ensureQueryData(queries.auth.me);
  },
  component: ProfilePage,
});
