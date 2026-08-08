import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import type { OrganizationId } from "@namera-ai/protocol";
import type { OrganizationMember, OrganizationRole, User } from "@namera-ai/protocol/model";

export interface MemberView {
  readonly organizationMember: OrganizationMember;
  readonly organizationRole: OrganizationRole;
  readonly user: User;
}

export interface MemberApplication {
  readonly listMembers: (
    organizationId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<MemberView>>;
}

export const makeMemberApplication = Effect.gen(function* () {
  const repository = yield* Repository;

  const listMembers = Effect.fn("Application.organization.member.listMembers")(
    function* (organizationId: OrganizationId) {
      return yield* repository.auth.member.findOrganizationMembersForOrg(organizationId);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { listMembers } satisfies MemberApplication;
});
