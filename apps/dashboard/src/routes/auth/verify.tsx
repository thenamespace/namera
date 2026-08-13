import { createFileRoute } from "@tanstack/react-router";

import { VerifyForm } from "./-components/verify-form";

export const Route = createFileRoute("/auth/verify")({
  validateSearch: (search): { id?: string; token?: string } => ({
    ...(typeof search.id === "string" ? { id: search.id } : {}),
    ...(typeof search.token === "string" ? { token: search.token } : {}),
  }),
  component: VerifyRoute,
});

function VerifyRoute() {
  return <VerifyForm search={Route.useSearch()} />;
}
