// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema, type DateTime } from "effect";

import type { DatabaseError } from "@namera-ai/protocol";
import { type Email, type InvitationId, type OrganizationId } from "@namera-ai/protocol";
import type { OrganizationRole } from "@namera-ai/protocol/model";
import {
  Invitation,
  InvitationInsert,
  InvitationUpdate,
  Organization,
  User,
} from "@namera-ai/protocol/model";
import { and, eq, gt, lte } from "drizzle-orm";

import { Database, mapRepositoryError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { decodeJoinedOrganizationRole } from "#/repositories/auth/organization/common";
import { invitation } from "#/schema/index";

export interface OrganizationInvitationRepositoryService {
  insert: (data: InvitationInsert) => Effect.Effect<Invitation | undefined, DatabaseError>;
  findById: (
    id: InvitationId,
    orgId: OrganizationId,
  ) => Effect.Effect<
    | {
        organization: Organization;
        invitation: Invitation;
        organizationRole: OrganizationRole;
        inviter: User;
      }
    | undefined,
    DatabaseError
  >;
  findPendingForOrgId: (
    organizationId: OrganizationId,
    now: DateTime.Utc,
  ) => Effect.Effect<
    ReadonlyArray<{
      invitation: Invitation;
      organization: Organization;
      organizationRole: OrganizationRole;
      inviter: User;
    }>,
    DatabaseError
  >;
  findPendingForEmail: (
    email: Email,
    now: DateTime.Utc,
  ) => Effect.Effect<
    ReadonlyArray<{
      invitation: Invitation;
      organization: Organization;
      organizationRole: OrganizationRole;
      inviter: User;
    }>,
    DatabaseError
  >;
  findByIdForEmail: (
    id: InvitationId,
    email: Email,
  ) => Effect.Effect<
    | {
        organization: Organization;
        invitation: Invitation;
        organizationRole: OrganizationRole;
        inviter: User;
      }
    | undefined,
    DatabaseError
  >;
  existsById: (id: InvitationId) => Effect.Effect<boolean, DatabaseError>;
  acceptPending: (
    invitationId: InvitationId,
    email: Email,
    now: DateTime.Utc,
  ) => Effect.Effect<Invitation | undefined, DatabaseError>;
  rejectPending: (
    invitationId: InvitationId,
    email: Email,
    now: DateTime.Utc,
  ) => Effect.Effect<Invitation | undefined, DatabaseError>;
  cancelPending: (
    invitationId: InvitationId,
    organizationId: OrganizationId,
  ) => Effect.Effect<Invitation | undefined, DatabaseError>;
  expirePendingForEmail: (
    organizationId: OrganizationId,
    email: Email,
    now: DateTime.Utc,
  ) => Effect.Effect<ReadonlyArray<Invitation>, DatabaseError>;
}

export class OrganizationInvitationRepository extends Context.Service<
  OrganizationInvitationRepository,
  OrganizationInvitationRepositoryService
>()("@namera-ai/database/OrganizationInvitationRepository") {
  static readonly layer: Layer.Layer<OrganizationInvitationRepository, never, Database> =
    Layer.effect(
      OrganizationInvitationRepository,
      Effect.gen(function* () {
        const database = yield* Database;

        return OrganizationInvitationRepository.of({
          insert: Effect.fn("database.insertOrganizationInvitation")(function* (data) {
            const db = yield* transactionOrDatabase(database);
            const parsed = Schema.encodeSync(InvitationInsert)(data);
            const res = yield* db
              .insert(invitation)
              .values(parsed as any)
              .onConflictDoNothing()
              .returning();

            return res[0] ? Schema.decodeSync(Invitation)(res[0]) : undefined;
          }, mapRepositoryError),
          findById: Effect.fn("database.findOrganizationInvitationById")(function* (id, orgId) {
            const db = yield* transactionOrDatabase(database);

            const res = yield* db.query.invitation.findFirst({
              where: {
                id: { eq: id },
                organizationId: { eq: orgId },
              },
              with: {
                inviter: true,
                organization: true,
                organizationRole: {
                  with: {
                    systemRole: true,
                  },
                },
              },
            });

            if (!res) {
              return undefined;
            }

            const { inviter, organization, organizationRole, ...invitationRow } = res;

            return {
              organization: Schema.decodeSync(Organization)(organization),
              invitation: Schema.decodeSync(Invitation)(invitationRow),
              organizationRole: decodeJoinedOrganizationRole(organizationRole),
              inviter: Schema.decodeSync(User)(inviter),
            };
          }, mapRepositoryError),
          findPendingForOrgId: Effect.fn("database.findPendingInvitationsForOrgId")(function* (
            organizationId,
            now,
          ) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);

            const res = yield* db.query.invitation.findMany({
              where: {
                organizationId: { eq: organizationId },
                status: { eq: "pending" },
                expiresAt: { gt: encodedNow },
              },
              with: {
                inviter: true,
                organization: true,
                organizationRole: {
                  with: {
                    systemRole: true,
                  },
                },
              },
            });

            return res.map((row) => {
              const { inviter, organization, organizationRole, ...invitationRow } = row;

              return {
                invitation: Schema.decodeSync(Invitation)(invitationRow),
                organization: Schema.decodeSync(Organization)(organization),
                organizationRole: decodeJoinedOrganizationRole(organizationRole),
                inviter: Schema.decodeSync(User)(inviter),
              };
            });
          }, mapRepositoryError),
          findPendingForEmail: Effect.fn("database.findPendingInvitationsForEmail")(function* (
            email,
            now,
          ) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);

            const res = yield* db.query.invitation.findMany({
              where: {
                email: { eq: email },
                status: { eq: "pending" },
                expiresAt: { gt: encodedNow },
              },
              with: {
                inviter: true,
                organization: true,
                organizationRole: {
                  with: {
                    systemRole: true,
                  },
                },
              },
            });

            return res.map((row) => {
              const { inviter, organization, organizationRole, ...invitationRow } = row;

              return {
                invitation: Schema.decodeSync(Invitation)(invitationRow),
                organization: Schema.decodeSync(Organization)(organization),
                organizationRole: decodeJoinedOrganizationRole(organizationRole),
                inviter: Schema.decodeSync(User)(inviter),
              };
            });
          }, mapRepositoryError),
          findByIdForEmail: Effect.fn("database.findInvitationByIdForEmail")(function* (id, email) {
            const db = yield* transactionOrDatabase(database);

            const res = yield* db.query.invitation.findFirst({
              where: {
                id: { eq: id },
                email: { eq: email },
              },
              with: {
                inviter: true,
                organization: true,
                organizationRole: {
                  with: {
                    systemRole: true,
                  },
                },
              },
            });

            if (!res) {
              return undefined;
            }

            const { inviter, organization, organizationRole, ...invitationRow } = res;

            return {
              organization: Schema.decodeSync(Organization)(organization),
              invitation: Schema.decodeSync(Invitation)(invitationRow),
              organizationRole: decodeJoinedOrganizationRole(organizationRole),
              inviter: Schema.decodeSync(User)(inviter),
            };
          }, mapRepositoryError),
          existsById: Effect.fn("database.organizationInvitationExistsById")(function* (id) {
            const db = yield* transactionOrDatabase(database);
            const res = yield* db
              .select({ id: invitation.id })
              .from(invitation)
              .where(eq(invitation.id, id))
              .limit(1);

            return res.length > 0;
          }, mapRepositoryError),
          acceptPending: Effect.fn("database.acceptPendingOrganizationInvitation")(function* (
            invitationId,
            email,
            now,
          ) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
            const parsed = Schema.encodeSync(InvitationUpdate)({ status: "accepted" });
            const res = yield* db
              .update(invitation)
              .set(parsed as any)
              .where(
                and(
                  eq(invitation.id, invitationId),
                  eq(invitation.email, email),
                  eq(invitation.status, "pending"),
                  gt(invitation.expiresAt, encodedNow),
                ),
              )
              .returning();

            return res[0] ? Schema.decodeSync(Invitation)(res[0]) : undefined;
          }, mapRepositoryError),
          rejectPending: Effect.fn("database.rejectPendingOrganizationInvitation")(function* (
            invitationId,
            email,
            now,
          ) {
            const db = yield* transactionOrDatabase(database);
            const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
            const parsed = Schema.encodeSync(InvitationUpdate)({ status: "rejected" });
            const res = yield* db
              .update(invitation)
              .set(parsed as any)
              .where(
                and(
                  eq(invitation.id, invitationId),
                  eq(invitation.email, email),
                  eq(invitation.status, "pending"),
                  gt(invitation.expiresAt, encodedNow),
                ),
              )
              .returning();

            return res[0] ? Schema.decodeSync(Invitation)(res[0]) : undefined;
          }, mapRepositoryError),
          cancelPending: Effect.fn("database.cancelPendingOrganizationInvitation")(function* (
            invitationId,
            organizationId,
          ) {
            const db = yield* transactionOrDatabase(database);
            const parsed = Schema.encodeSync(InvitationUpdate)({ status: "canceled" });
            const res = yield* db
              .update(invitation)
              .set(parsed as any)
              .where(
                and(
                  eq(invitation.id, invitationId),
                  eq(invitation.organizationId, organizationId),
                  eq(invitation.status, "pending"),
                ),
              )
              .returning();

            return res[0] ? Schema.decodeSync(Invitation)(res[0]) : undefined;
          }, mapRepositoryError),
          expirePendingForEmail: Effect.fn("database.expirePendingOrganizationInvitationsForEmail")(
            function* (organizationId, email, now) {
              const db = yield* transactionOrDatabase(database);
              const encodedNow = Schema.encodeSync(Schema.DateTimeUtcFromDate)(now);
              const parsed = Schema.encodeSync(InvitationUpdate)({ status: "expired" });
              const res = yield* db
                .update(invitation)
                .set(parsed as any)
                .where(
                  and(
                    eq(invitation.organizationId, organizationId),
                    eq(invitation.email, email),
                    eq(invitation.status, "pending"),
                    lte(invitation.expiresAt, encodedNow),
                  ),
                )
                .returning();

              return Schema.decodeSync(Schema.Array(Invitation))(res);
            },
            mapRepositoryError,
          ),
        });
      }),
    );
}
