import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";

import { ProfileForm } from "./profile-form";

export function ProfilePage() {
  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 md:py-16">
        <HeadingGroup className="mb-8" heading="Profile" level={1} size="lg" />
        <ProfileForm />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
