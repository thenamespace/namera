import { createFileRoute } from "@tanstack/react-router";

import { SessionKeyExecutionsPlaceholder } from "../-components/session-key-section-placeholder";

export const Route = createFileRoute("/_authenticated/session-key/$sessionKeyId/executions")({
  component: SessionKeyExecutionsPlaceholder,
});
