import { Effect } from "effect";

import { Database } from "@namera-ai/database";
import type { OrganizationId } from "@namera-ai/protocol";

/** Reconstruct a pre-rollout subscription for compatibility tests only. */
export const seedLegacyBilling = Effect.fnUntraced(function* (organizationId: OrganizationId) {
  if (!/^[0-9a-f-]{36}$/.test(organizationId)) return yield* Effect.die("Invalid fixture ID");
  const db = yield* Database;
  yield* db.execute(
    `UPDATE billing.subscription SET plan_version = 1 WHERE organization_id = '${organizationId}'`,
  );
  yield* db.execute(
    `UPDATE billing.period SET plan_version = 1 WHERE organization_id = '${organizationId}'`,
  );
  yield* db.execute(
    `UPDATE billing.meter_balance SET included_amount = 1000, hard_limit_amount = 1000 WHERE organization_id = '${organizationId}' AND meter_key = 'execution.testnet'`,
  );
  yield* db.execute(
    `UPDATE billing.meter_balance SET included_amount = 10000, hard_limit_amount = 10000 WHERE organization_id = '${organizationId}' AND meter_key = 'signature'`,
  );
});
