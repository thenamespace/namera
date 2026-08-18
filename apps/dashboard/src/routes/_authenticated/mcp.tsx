import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/mcp")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/workspace/mcp", replace: true });
  },
});
