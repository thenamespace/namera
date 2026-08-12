import { DateTime, Effect, Equal, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import {
  OrganizationError,
  type ActorId,
  type OrganizationId,
  type SessionId,
  type UserId,
} from "@namera-ai/protocol";
import type {
  Organization,
  OrganizationMember,
  OrganizationMetadata,
  OrganizationRole,
  User,
} from "@namera-ai/protocol/model";
import {
  organizationCreations,
  organizationUpdates,
  sessionLifecycleEvents,
} from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";

import { createOrganizationWithOwner } from "./helpers.js";

export interface MembershipView {
  readonly organizationMember: OrganizationMember;
  readonly organization: Organization;
  readonly organizationRole: OrganizationRole;
  readonly user: User;
}

export interface OrganizationApplication {
  readonly create: (
    userId: UserId,
    sessionId: SessionId,
    metadata: OrganizationMetadata,
  ) => Effect.Effect<Organization, OrganizationError>;
  readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<MembershipView>>;
  readonly get: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<Organization, OrganizationError>;
  readonly setActive: (
    userId: UserId,
    sessionId: SessionId,
    organizationId: OrganizationId,
  ) => Effect.Effect<void, OrganizationError>;
  readonly update: (
    actorId: ActorId,
    organizationId: OrganizationId,
    metadata: OrganizationMetadata,
  ) => Effect.Effect<Organization, OrganizationError>;
}

export const makeOrganizationApplication = Effect.gen(function* () {
  const repository = yield* Repository;
  const audit = yield* Audit;
  const transaction = yield* TransactionService;

  const create = Effect.fn("Application.organization.create")(
    function* (userId: UserId, sessionId: SessionId, metadata: OrganizationMetadata) {
      const now = yield* DateTime.now;
      const organization = yield* transaction.run(
        Effect.gen(function* () {
          const created = yield* createOrganizationWithOwner(
            repository,
            audit,
            userId,
            metadata.name,
          );
          if (metadata.logo !== undefined || metadata.description !== undefined) {
            yield* repository.auth.organization.update(created.id, metadata);
          }
          yield* repository.auth.session.setActiveOrganization(sessionId, userId, created.id, now);
          yield* audit.user({
            userId,
            sessionId,
            event: "session.active_organization_changed",
            data: { version: 1, organizationId: created.id },
          });
          return { ...created, metadata };
        }),
      );
      yield* Metric.update(organizationCreations, 1);
      yield* Metric.update(sessionLifecycleEvents, "active_organization_changed");
      yield* Effect.logInfo("organization.created");
      return organization;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const list = Effect.fn("Application.organization.list")(
    function* (userId: UserId) {
      return yield* repository.auth.member.findMembershipsForUser(userId);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const get = Effect.fn("Application.organization.get")(
    function* (userId: UserId, organizationId: OrganizationId) {
      const membership = yield* repository.auth.member.findActiveMembership(userId, organizationId);
      if (!membership) {
        return yield* new OrganizationError({ code: "ORGANIZATION_NOT_FOUND" });
      }
      return membership.organization;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const setActive = Effect.fn("Application.organization.setActive")(
    function* (userId: UserId, sessionId: SessionId, organizationId: OrganizationId) {
      const result = yield* transaction.run(
        Effect.gen(function* () {
          const now = yield* DateTime.now;
          const current = yield* repository.auth.session.findActiveById(sessionId, userId, now);
          if (!current) return "not-found" as const;
          if (current.activeOrganizationId === organizationId) return "unchanged" as const;
          const session = yield* repository.auth.session.setActiveOrganization(
            sessionId,
            userId,
            organizationId,
            now,
          );
          if (!session) return "not-found" as const;
          yield* audit.user({
            userId,
            sessionId,
            event: "session.active_organization_changed",
            data: { version: 1, organizationId },
          });
          return "changed" as const;
        }),
      );
      if (result === "not-found") {
        return yield* new OrganizationError({ code: "ORGANIZATION_NOT_FOUND" });
      }
      if (result === "changed") {
        yield* Metric.update(sessionLifecycleEvents, "active_organization_changed");
        yield* Effect.logInfo("organization.active_changed");
      }
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const update = Effect.fn("Application.organization.update")(
    function* (actorId: ActorId, organizationId: OrganizationId, metadata: OrganizationMetadata) {
      const result = yield* transaction.run(
        Effect.gen(function* () {
          const current = yield* repository.auth.organization.findById(organizationId);
          if (!current) {
            return yield* new OrganizationError({ code: "ORGANIZATION_NOT_FOUND" });
          }
          if (Equal.equals(current.metadata, metadata)) {
            return { organization: current, changed: false } as const;
          }
          const organization = yield* repository.auth.organization.update(organizationId, metadata);
          if (!organization) {
            return yield* new OrganizationError({ code: "ORGANIZATION_NOT_FOUND" });
          }
          yield* audit.organization({
            organizationId,
            actorId,
            event: "organization.updated",
            resourceType: "organization",
            resourceId: organizationId,
            data: { version: 1, changedFields: ["metadata"] },
          });
          return { organization, changed: true } as const;
        }),
      );
      if (result.changed) {
        yield* Metric.update(organizationUpdates, 1);
        yield* Effect.logInfo("organization.updated");
      }
      return result.organization;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { create, list, get, setActive, update } satisfies OrganizationApplication;
});
