import { DateTime, Effect } from "effect";

import { Repository } from "@namera-ai/database";
import type { ActorId, OrganizationId } from "@namera-ai/protocol";
import type { ApiKeyPermission, MemberPermission } from "@namera-ai/protocol/model";

export const managementMemberPermission: Readonly<Record<ApiKeyPermission, MemberPermission>> = {
  "wallet:read": "wallet:read",
  "wallet:create": "wallet:create",
  "session-key:read": "session-key:read",
  "session-key:create": "session-key:create",
  "session-key:install": "session-key:create",
  "session-key:uninstall": "session-key:revoke",
  "session-key:revoke": "session-key:revoke",
};

/** Call inside the admission transaction, before billing and wallet locks. */
export const makeCheckManagementAuthority = Effect.gen(function* () {
  const repository = yield* Repository;
  return Effect.fn("application.checkManagementAuthority")(function* (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly permission: ApiKeyPermission;
  }) {
    const key = yield* repository.auth.apiKey.findByActorIdForUpdate(
      input.actorId,
      input.organizationId,
    );
    if (key !== undefined) {
      const now = yield* DateTime.now;
      return (
        key.revokedAt === null &&
        key.expiresAt !== null &&
        DateTime.toEpochMillis(key.expiresAt) > DateTime.toEpochMillis(now) &&
        key.permissions.includes(input.permission)
      );
    }
    const membership = yield* repository.auth.member.lockByActorId(
      input.organizationId,
      input.actorId,
    );
    const [member] = yield* repository.auth.member.findByActorIds(input.organizationId, [
      input.actorId,
    ]);
    return (
      membership !== undefined &&
      membership.removedAt === null &&
      member !== undefined &&
      member.organizationRole.permissions.includes(managementMemberPermission[input.permission])
    );
  });
});
