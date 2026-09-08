import type { UserActorData } from "@namera-ai/protocol/dto";

/** Presentation metadata must not discard forms; authority changes must. */
export function sessionAuthority(actor: UserActorData | null | undefined) {
  if (actor === null || actor === undefined) return actor;
  return JSON.stringify([
    actor.user.id,
    actor.session.id,
    actor.organization.id,
    actor.member.organizationMember.id,
    actor.role.id,
    actor.role.permissions.toSorted(),
  ]);
}

export function canSaveInAuthority(
  expected: string | null | undefined,
  current: string | null | undefined,
) {
  return typeof expected === "string" && expected === current;
}
