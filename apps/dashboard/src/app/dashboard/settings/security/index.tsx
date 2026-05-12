import { createFileRoute } from "@tanstack/react-router";

import { Seo } from "@/components/misc";

import { SecurityContainer } from "../-components";

const ProfilePage = () => {
  return (
    <div>
      <Seo title="Security" />
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <SecurityContainer />
      </div>
    </div>
  );
};

export const Route = createFileRoute("/dashboard/settings/security/")({
  component: ProfilePage,
});
