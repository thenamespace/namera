import { createFileRoute } from "@tanstack/react-router";

import { getCurrentUserFn } from "@/lib/auth/wrapper";

const AuthPage = () => {
  const a = Route.useLoaderData();
  return <div>{JSON.stringify(a)}</div>;
};

export const Route = createFileRoute("/auth/")({
  component: AuthPage,
  loader: () => getCurrentUserFn(),
});
