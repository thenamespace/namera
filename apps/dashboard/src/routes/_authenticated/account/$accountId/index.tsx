import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/account/$accountId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/account/$accountId/overview",
      params,
      replace: true,
    });
  },
});
