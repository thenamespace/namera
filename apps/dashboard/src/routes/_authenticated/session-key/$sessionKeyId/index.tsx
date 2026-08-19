import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/session-key/$sessionKeyId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/session-key/$sessionKeyId/overview",
      params,
      replace: true,
    });
  },
});
