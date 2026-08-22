import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/session-key/$sessionKeyId/executions")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/session-key/$sessionKeyId/usage",
      params,
      replace: true,
    });
  },
});
