import { createFileRoute } from "@tanstack/react-router";

import { VerifyForm } from "./-components/verify-form";

export const Route = createFileRoute("/auth/verify")({
  component: VerifyForm,
});
