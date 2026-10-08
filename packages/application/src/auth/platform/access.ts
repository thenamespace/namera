import { DateTime, Effect } from "effect";

import type { RepositoryService } from "@namera-ai/database";
import { PlatformAuthError, type SessionId, type UserId } from "@namera-ai/protocol";
import { platformPermissions, type PlatformPermission } from "@namera-ai/protocol/model";

export interface PlatformSession {
  readonly userId: UserId;
  readonly sessionId: SessionId;
}

export const requirePlatformSession = Effect.fnUntraced(function* (
  repository: RepositoryService,
  context: PlatformSession,
) {
  const now = yield* DateTime.now;
  const session = yield* repository.auth.session.findActiveById(
    context.sessionId,
    context.userId,
    now,
  );
  const user = yield* repository.auth.user.findById(context.userId);
  if (!session || !user?.emailVerified)
    return yield* new PlatformAuthError({ code: "VERIFIED_USER_REQUIRED" });
  return user;
});

export const requirePlatformPermission = Effect.fnUntraced(function* (
  repository: RepositoryService,
  context: PlatformSession,
  permission: PlatformPermission,
) {
  yield* requirePlatformSession(repository, context);
  const member = yield* repository.auth.platform.findMember(context.userId);
  if (
    !member ||
    member.status !== "active" ||
    !platformPermissions[member.role].includes(permission)
  )
    return yield* new PlatformAuthError({ code: "ADMIN_ACCESS_REQUIRED" });
  return member;
});
