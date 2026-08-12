import { DateTime, Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import {
  OrganizationMemberNotFoundError,
  OrganizationNotFoundError,
  OrganizationPermissionError,
  type ActorId,
  type OrganizationError,
  type OrganizationId,
  type OrganizationMemberError,
  type OrganizationMemberId,
  type OrganizationRoleId,
} from "@namera-ai/protocol";
import type {
  MemberPermission,
  OrganizationMember,
  OrganizationRole,
  User,
} from "@namera-ai/protocol/model";
import { organizationMemberEvents } from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";

export interface MemberView {
  readonly organizationMember: OrganizationMember;
  readonly organizationRole: OrganizationRole;
  readonly user: User;
}

export interface MemberApplication {
  readonly listMembers: (
    organizationId: OrganizationId,
  ) => Effect.Effect<ReadonlyArray<MemberView>>;
  readonly updateRole: (input: {
    actorId: ActorId;
    actorPermissions: ReadonlyArray<MemberPermission>;
    organizationId: OrganizationId;
    organizationMemberId: OrganizationMemberId;
    organizationRoleId: OrganizationRoleId;
  }) => Effect.Effect<MemberView, OrganizationError | OrganizationMemberError>;
  readonly remove: (input: {
    actorId: ActorId;
    actorPermissions: ReadonlyArray<MemberPermission>;
    organizationId: OrganizationId;
    organizationMemberId: OrganizationMemberId;
  }) => Effect.Effect<void, OrganizationError | OrganizationMemberError>;
}

const includesAllPermissions = (
  granted: ReadonlyArray<MemberPermission>,
  required: ReadonlyArray<MemberPermission>,
) => required.every((permission) => granted.includes(permission));

const canManageRole = (
  actorPermissions: ReadonlyArray<MemberPermission>,
  targetPermissions: ReadonlyArray<MemberPermission>,
) =>
  includesAllPermissions(actorPermissions, targetPermissions) &&
  actorPermissions.some((permission) => !targetPermissions.includes(permission));

export const makeMemberApplication = Effect.gen(function* () {
  const audit = yield* Audit;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;

  const listMembers = Effect.fn("Application.organization.member.listMembers")(
    function* (organizationId: OrganizationId) {
      return yield* repository.auth.member.findOrganizationMembersForOrg(organizationId);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const updateRole = Effect.fn("Application.organization.member.updateRole")(
    function* (input: {
      actorId: ActorId;
      actorPermissions: ReadonlyArray<MemberPermission>;
      organizationId: OrganizationId;
      organizationMemberId: OrganizationMemberId;
      organizationRoleId: OrganizationRoleId;
    }) {
      const result = yield* transaction.run(
        Effect.gen(function* () {
          const target = yield* repository.auth.member.findActiveById(
            input.organizationMemberId,
            input.organizationId,
          );
          if (!target) {
            return yield* new OrganizationMemberNotFoundError({
              code: "ORGANIZATION_MEMBER_NOT_FOUND",
            });
          }
          if (!canManageRole(input.actorPermissions, target.organizationRole.permissions)) {
            return yield* new OrganizationPermissionError({ code: "INSUFFICIENT_PERMISSIONS" });
          }

          const role = yield* repository.auth.role.findById(
            input.organizationId,
            input.organizationRoleId,
          );
          if (!role) {
            return yield* new OrganizationNotFoundError({ code: "ORGANIZATION_NOT_FOUND" });
          }
          if (!includesAllPermissions(input.actorPermissions, role.permissions)) {
            return yield* new OrganizationPermissionError({ code: "INSUFFICIENT_PERMISSIONS" });
          }
          if (target.organizationMember.organizationRoleId === role.id) {
            return { member: target, changed: false } as const;
          }

          const member = yield* repository.auth.member.assignRole(
            target.organizationMember.id,
            input.organizationId,
            target.organizationMember.organizationRoleId,
            role.id,
          );
          if (!member) {
            return yield* new OrganizationMemberNotFoundError({
              code: "ORGANIZATION_MEMBER_NOT_FOUND",
            });
          }
          yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "member.role_updated",
            resourceType: "member",
            resourceId: member.id,
            data: {
              version: 1,
              previousOrganizationRoleId: target.organizationMember.organizationRoleId,
              organizationRoleId: role.id,
            },
          });
          return {
            member: {
              organizationMember: member,
              organizationRole: role,
              user: target.user,
            },
            changed: true,
          } as const;
        }),
      );
      if (result.changed) {
        yield* Metric.update(organizationMemberEvents, "role_updated");
        yield* Effect.logInfo("organization.member.role_updated");
      }
      return result.member;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const remove = Effect.fn("Application.organization.member.remove")(
    function* (input: {
      actorId: ActorId;
      actorPermissions: ReadonlyArray<MemberPermission>;
      organizationId: OrganizationId;
      organizationMemberId: OrganizationMemberId;
    }) {
      yield* transaction.run(
        Effect.gen(function* () {
          const target = yield* repository.auth.member.findActiveById(
            input.organizationMemberId,
            input.organizationId,
          );
          if (!target) {
            return yield* new OrganizationMemberNotFoundError({
              code: "ORGANIZATION_MEMBER_NOT_FOUND",
            });
          }
          if (!canManageRole(input.actorPermissions, target.organizationRole.permissions)) {
            return yield* new OrganizationPermissionError({ code: "INSUFFICIENT_PERMISSIONS" });
          }

          const member = yield* repository.auth.member.remove(
            target.organizationMember.id,
            input.organizationId,
            target.organizationMember.organizationRoleId,
            yield* DateTime.now,
          );
          if (!member) {
            return yield* new OrganizationMemberNotFoundError({
              code: "ORGANIZATION_MEMBER_NOT_FOUND",
            });
          }
          yield* audit.organization({
            organizationId: input.organizationId,
            actorId: input.actorId,
            event: "member.removed",
            resourceType: "member",
            resourceId: member.id,
            data: {
              version: 1,
              userId: member.userId,
              organizationRoleId: target.organizationRole.id,
            },
          });
        }),
      );
      yield* Metric.update(organizationMemberEvents, "removed");
      yield* Effect.logInfo("organization.member.removed");
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { listMembers, updateRole, remove } satisfies MemberApplication;
});
