import { Effect } from "effect";

import type { RepositoryService } from "@namera-ai/database";
import type { OrganizationId } from "@namera-ai/protocol";

export const lockOrganizationBilling = Effect.fn("application.lockOrganizationBilling")(function* (
  repository: RepositoryService,
  organizationId: OrganizationId,
) {
  const account = yield* repository.billing.account.lockByOrganizationId(organizationId);
  if (!account) return yield* Effect.die("Organization billing account is missing");
});
