import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import type { OrganizationEvent, ProductMilestone, UserEvent } from "@namera-ai/protocol/model";
import { AnalyticsCollection } from "@namera-ai/telemetry/analytics/collection";

const milestones = {
  "organization.created": "workspace_created",
  "wallet.created": "account_created",
  "session_key.created": "session_key_created",
  "session_key.revoked": "session_key_revoked",
  "session_key.operation_prepared": "session_installation_prepared",
  "session_key.operation_confirmed": "session_installation_confirmed",
  "session_key.operation_failed": "session_installation_failed",
  "api_key.created": "api_key_created",
  "api_key.revoked": "api_key_revoked",
  "mcp_authorization.approved": "mcp_connected",
  "mcp_authorization.revoked": "mcp_disconnected",
  "cli_authorization.approved": "cli_connected",
  "cli_authorization.revoked": "cli_disconnected",
  "execution.prepared": "execution_prepared",
  "execution.submitted": "execution_submitted",
  "execution.confirmed": "execution_confirmed",
  "execution.failed": "execution_failed",
  "signature.created": "signing_completed",
} as const satisfies Partial<Record<OrganizationEvent["event"], ProductMilestone["event"]>>;

/** Only explicitly selected dimensions leave the audit boundary. */
export function organizationMilestone(event: OrganizationEvent) {
  const name = milestones[event.event as keyof typeof milestones];
  if (!name) return undefined;
  const properties: ProductMilestone["properties"] = {
    workspace_id: event.organizationId,
    resource_id: event.resourceId,
    ...("chainId" in event.data ? { chain_id: event.data.chainId } : {}),
    ...("namespace" in event.data ? { namespace: event.data.namespace } : {}),
    ...("stage" in event.data ? { stage: event.data.stage } : {}),
    ...("kind" in event.data ? { kind: event.data.kind } : {}),
    ...(event.event === "signature.created" ? { kind: event.data.type } : {}),
  };
  let eligibility: string | undefined;
  if (event.event.startsWith("execution.")) {
    eligibility = `eligibility:execution:${event.event === "execution.confirmed" ? event.data.submissionId : event.resourceId}`;
  } else if ("operationId" in event.data) {
    eligibility = `eligibility:session:${event.data.operationId}`;
  }
  const begins =
    event.event === "execution.prepared" || event.event === "session_key.operation_prepared";
  return { event: name, properties, eligibility, begins };
}

export const makeAuditAnalytics = Effect.gen(function* () {
  const repository = (yield* Repository).jobs.analytics;
  return {
    user: Effect.fnUntraced(function* (event: UserEvent) {
      if ((yield* AnalyticsCollection) !== "enabled") return;
      if (event.event !== "user.created" && event.event !== "user.signed_in") return;
      yield* repository.enqueue(`audit:${event.id}`, {
        event: event.event === "user.created" ? "signup_completed" : "login_completed",
        distinctId: event.userId,
        properties: {
          actor_kind: "user",
          ...(event.event === "user.signed_in" ? { kind: event.data.method } : {}),
        },
      });
    }),
    organization: Effect.fnUntraced(function* (event: OrganizationEvent) {
      const collection = yield* AnalyticsCollection;
      if (collection === "disabled" || !event.actorId) return;
      const milestone = organizationMilestone(event);
      if (!milestone) return;
      // Workers may only follow a previously opted-in operation, not backfill old activity.
      if (
        collection === "background" &&
        (!milestone.eligibility || !(yield* repository.has(milestone.eligibility)))
      )
        return;
      const attribution = yield* repository.attribution(event.actorId);
      if (!attribution) return;
      const payload: ProductMilestone = {
        event: milestone.event,
        distinctId: attribution.distinctId,
        properties: { ...milestone.properties, actor_kind: attribution.actor_kind },
      };
      yield* repository.enqueue(
        milestone.begins && milestone.eligibility ? milestone.eligibility : `audit:${event.id}`,
        payload,
      );
      if (event.event === "execution.confirmed" || event.event === "signature.created") {
        yield* repository.enqueue(`activation:${event.organizationId}`, {
          ...payload,
          event: "workspace_activated",
        });
      }
    }),
  };
});
