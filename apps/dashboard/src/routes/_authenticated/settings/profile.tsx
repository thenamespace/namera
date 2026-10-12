import { createFileRoute, redirect } from "@tanstack/react-router";

import { currentUserAtom } from "@/atoms/auth/session";
import { prefetchQuery } from "@/atoms/prefetch";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import { useCurrentUser } from "@/hooks/auth";

import { ProfileForm } from "./-components/profile-form";

export const Route = createFileRoute("/_authenticated/settings/profile")({
  loader: async ({ abortController, context }) => {
    const currentUser = await prefetchQuery(
      context.atomRegistry,
      currentUserAtom,
      abortController.signal,
    );
    if (currentUser === null) throw redirect({ to: "/auth", replace: true });
    return currentUser.user;
  },
  component: ProfilePage,
});

function ProfilePage() {
  const initialUser = Route.useLoaderData();
  const currentUser = useCurrentUser();
  const user = currentUser.data?.user ?? initialUser;

  return (
    <DashboardPage>
      <DashboardPage.Header className="md:hidden">
        <DashboardPage.Title />
      </DashboardPage.Header>
      <DashboardPage.Content className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 md:py-16">
        <HeadingGroup className="mb-8">
          <HeadingGroup.Title level={1} size="lg">
            Profile
          </HeadingGroup.Title>
        </HeadingGroup>
        <ProfileForm user={user} />
      </DashboardPage.Content>
    </DashboardPage>
  );
}
