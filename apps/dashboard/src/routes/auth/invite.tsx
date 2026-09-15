import { createFileRoute } from "@tanstack/react-router";

import { InviteForm } from "./-components/invite-form";

export const Route = createFileRoute("/auth/invite")({ component: InviteForm });
