import { createFileRoute } from "@tanstack/react-router";

import { ProfileForm } from "../-components";

const ProfilePage = () => {
  return (
    <div>
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <ProfileForm />
      </div>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/settings/profile/")({
  component: ProfilePage,
});
