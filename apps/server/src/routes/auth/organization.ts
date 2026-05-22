import { Effect } from "effect";

import { HttpApiBuilder } from "effect/unstable/httpapi";

import { api, AuthenticatedUser } from "@namera-ai/api";
import { AdminDatabase, Database, Transaction } from "@namera-ai/database";
import * as AuthRepo from "@namera-ai/domain/auth";
import {
  type GetFullOrganizationRequest,
  OrganizationError,
  type CreateOrganizationRequest,
  type SetActiveOrganizationRequest,
  type UpdateOrganizationRequest,
  mapDatabaseError,
} from "@namera-ai/schema";

const createOrganizationHandler = (payload: CreateOrganizationRequest) =>
  Effect.gen(function* () {
    const currentUser = yield* AuthenticatedUser;
    const auth = yield* AuthRepo.AuthRepo;
    const db = yield* AdminDatabase.AdminDatabase;

    const res = yield* db.transaction((tx) =>
      Effect.gen(function* () {
        const orgsCreatedByUser =
          yield* auth.organization.listOrgsCreatedByUser(currentUser.user.id);

        if (orgsCreatedByUser.length >= 3) {
          return yield* new OrganizationError({
            code: "ORGANIZATION_CREATION_LIMIT_REACHED",
          });
        }

        // Create Organization
        const newOrg = yield* auth.organization.create({
          ...payload,
          plan: "free",
          createdById: currentUser.user.id,
        });

        // Create default system roles.
        const { ownerRole } = yield* auth.role.createSystemRoles(newOrg.id);

        // Create owner member
        yield* auth.member.create({
          organizationId: newOrg.id,
          userId: currentUser.user.id,
          roleId: ownerRole.id,
          joinedAt: new Date(),
        });

        // Set current user's active organization
        yield* auth.session.setActiveOrganization(
          currentUser.session.id,
          currentUser.user.id,
          newOrg.id,
        );

        return newOrg;
      }).pipe(Transaction.withTx(tx)),
    );

    return res;
  }).pipe(mapDatabaseError);

const listOrgsHandler = () =>
  Effect.gen(function* () {
    const currentUser = yield* AuthenticatedUser;
    const auth = yield* AuthRepo.AuthRepo;

    const res = yield* auth.organization.list(currentUser.user.id);

    return res;
  }).pipe(mapDatabaseError);

const setActiveOrganizationHandler = (payload: SetActiveOrganizationRequest) =>
  Effect.gen(function* () {
    const currentUser = yield* AuthenticatedUser;
    const auth = yield* AuthRepo.AuthRepo;
    const db = yield* Database.Database;

    return yield* db.transaction((tx) =>
      Effect.gen(function* () {
        const isMember = yield* auth.organization.hasActiveMembership(
          currentUser.user.id,
          payload.id,
        );

        if (!isMember) {
          return yield* new OrganizationError({
            code: "ORGANIZATION_MEMBER_NOT_FOUND",
          });
        }

        yield* auth.session.setActiveOrganization(
          currentUser.session.id,
          currentUser.user.id,
          payload.id,
        );
      }).pipe(Transaction.withTx(tx)),
    );
  }).pipe(mapDatabaseError);

const getFullOrganizationHandler = (params: GetFullOrganizationRequest) =>
  Effect.gen(function* () {
    const auth = yield* AuthRepo.AuthRepo;
    const db = yield* AdminDatabase.AdminDatabase;

    return yield* db.transaction((tx) =>
      Effect.gen(function* () {
        return yield* auth.organization.getFullOrganization(params);
      }).pipe(Transaction.withTx(tx)),
    );
  }).pipe(mapDatabaseError);

const updateOrganizationHandler = (payload: UpdateOrganizationRequest) =>
  Effect.gen(function* () {
    const currentUser = yield* AuthenticatedUser;
    const auth = yield* AuthRepo.AuthRepo;
    const db = yield* AdminDatabase.AdminDatabase;

    return yield* db.transaction((tx) =>
      Effect.gen(function* () {
        return yield* auth.organization.updateOrganization(
          currentUser.user.id,
          payload,
        );
      }).pipe(Transaction.withTx(tx)),
    );
  }).pipe(mapDatabaseError);

export const OrganizationGroupLive = HttpApiBuilder.group(
  api,
  "organization",
  (handlers) =>
    handlers
      .handle("create", ({ payload }) => createOrganizationHandler(payload))
      .handle("list", () => listOrgsHandler())
      .handle("setActive", ({ payload }) =>
        setActiveOrganizationHandler(payload),
      )
      .handle("getFullOrganization", ({ params }) =>
        getFullOrganizationHandler(params),
      )
      .handle("update", ({ payload }) => updateOrganizationHandler(payload)),
);
