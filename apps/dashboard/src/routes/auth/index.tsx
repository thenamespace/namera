import { createFileRoute } from "@tanstack/react-router";

import { AuthForm } from "./-components/auth-form";

export const Route = createFileRoute("/auth/")({
  component: AuthPage,
});

function AuthPage() {
  const { returnTo } = Route.useSearch();
  return <AuthForm returnTo={returnTo} />;
}
