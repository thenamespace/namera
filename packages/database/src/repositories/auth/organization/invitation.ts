// oxlint-disable typescript/no-non-null-assertion typescript/no-explicit-any
import { Context, Effect, Layer, Schema } from "effect";

import type { DatabaseError } from "@namera-ai/protocol";
import { Email, type InvitationId, type OrganizationId } from "@namera-ai/protocol";
import type { OrganizationRole } from "@namera-ai/protocol/model";
import {
  Invitation,
  InvitationInsert,
  InvitationUpdate,
  Organization,
  User,
} from "@namera-ai/protocol/model";
import { eq } from "drizzle-orm";

import { Database, mapToDatabaseError } from "#/core/index";
import { transactionOrDatabase } from "#/core/transaction";
import { decodeJoinedOrganizationRole } from "#/repositories/auth/organization/common";
import { invitation } from "#/schema/index";

export type OrganizationInvitationRepository = {
  insert: (data: InvitationInsert) => Effect.Effect<Invitation, DatabaseError>;
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
  findForOrgId: (organizationId: OrganizationId) => Effect.Effect<
    Array<{
      invitation: Invitation;
      organizationRole: OrganizationRole;
      inviter: User;
    }>,
    DatabaseError
  >;
  findForEmail: (email: Email) => Effect.Effect<
    Array<{
      invitation: Invitation;
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
  update: (
    invitationId: InvitationId,
    data: InvitationUpdate,
  ) => Effect.Effect<Invitation | undefined, DatabaseError>;
};

export const OrganizationInvitationRepository = Context.Service<OrganizationInvitationRepository>(
  "OrganizationInvitationRepository",
);

export const layer: Layer.Layer<OrganizationInvitationRepository, never, Database.Database> =
  Layer.effect(
    OrganizationInvitationRepository,
    Effect.gen(function* () {
      const database = yield* Database.Database;

      return OrganizationInvitationRepository.of({
        insert: Effect.fn("insertOrganizationInvitation")(function* (data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(InvitationInsert)({
            ...data,
            email: Schema.decodeSync(Email)(data.email.toLowerCase()),
          });
          const res = yield* db
            .insert(invitation)
            .values(parsed as any)
            .returning();

          return Schema.decodeSync(Invitation)(res[0]!);
        }, mapToDatabaseError),
        findById: Effect.fn("findOrganizationInvitationById")(function* (id, orgId) {
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
        }, mapToDatabaseError),
        findForOrgId: Effect.fn("findInvitationsForOrgId")(function* (organizationId) {
          const db = yield* transactionOrDatabase(database);

          const res = yield* db.query.invitation.findMany({
            where: {
              organizationId: { eq: organizationId },
            },
            with: {
              inviter: true,
              organizationRole: {
                with: {
                  systemRole: true,
                },
              },
            },
          });

          return res.map((row) => {
            const { inviter, organizationRole, ...invitationRow } = row;

            return {
              invitation: Schema.decodeSync(Invitation)(invitationRow),
              organizationRole: decodeJoinedOrganizationRole(organizationRole),
              inviter: Schema.decodeSync(User)(inviter),
            };
          });
        }, mapToDatabaseError),
        findForEmail: Effect.fn("findInvitationsForEmail")(function* (email) {
          const db = yield* transactionOrDatabase(database);

          const res = yield* db.query.invitation.findMany({
            where: {
              email: { eq: email },
            },
            with: {
              inviter: true,
              organizationRole: {
                with: {
                  systemRole: true,
                },
              },
            },
          });

          return res.map((row) => {
            const { inviter, organizationRole, ...invitationRow } = row;

            return {
              invitation: Schema.decodeSync(Invitation)(invitationRow),
              organizationRole: decodeJoinedOrganizationRole(organizationRole),
              inviter: Schema.decodeSync(User)(inviter),
            };
          });
        }, mapToDatabaseError),
        findByIdForEmail: Effect.fn("findInvitationByIdForEmail")(function* (id, email) {
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
        }, mapToDatabaseError),
        update: Effect.fn("updateOrganizationInvitation")(function* (invitationId, data) {
          const db = yield* transactionOrDatabase(database);
          const parsed = Schema.encodeSync(InvitationUpdate)(data);
          const res = yield* db
            .update(invitation)
            .set(parsed as any)
            .where(eq(invitation.id, invitationId))
            .returning();

          return res[0] ? Schema.decodeSync(Invitation)(res[0]) : undefined;
        }, mapToDatabaseError),
      });
    }),
  );
