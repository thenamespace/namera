import { Effect } from "effect";

import { HttpApiBuilder } from "effect/unstable/httpapi";

import { api, AuthenticatedUser } from "@namera-ai/api";
import { AdminDatabase, Database, Transaction } from "@namera-ai/database";
import * as AuthRepo from "@namera-ai/domain/auth";
import {
  CheckOrganizationSlugRequest,
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

        // TODO: Make it configurable
        if (orgsCreatedByUser.length >= 3) {
          return yield* new OrganizationError({
            code: "ORGANIZATION_CREATION_LIMIT_REACHED",
          });
        }

        const isSlugTaken = yield* auth.organization.checkSlug(payload.slug);

        if (isSlugTaken) {
          return yield* new OrganizationError({
            code: "SLUG_ALREADY_TAKEN",
          });
        }

        const newOrg = yield* auth.organization.create({
          ...payload,
          plan: "free",
          createdById: currentUser.user.id,
        });

        return newOrg;
      }).pipe(Transaction.withTx(tx)),
    );

    return res;
  }).pipe(mapDatabaseError);

const checkSlugHandler = ({ slug }: CheckOrganizationSlugRequest) =>
  Effect.gen(function* () {
    const db = yield* AdminDatabase.AdminDatabase;
    const auth = yield* AuthRepo.AuthRepo;

    const isSlugTaken = yield* db.transaction((tx) =>
      Effect.gen(function* () {
        return yield* auth.organization.checkSlug(slug);
      }).pipe(Transaction.withTx(tx)),
    );

    return { isAvailable: !isSlugTaken };
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
      .handle("checkSlug", ({ payload }) => checkSlugHandler(payload))
      .handle("list", () => listOrgsHandler())
      .handle("setActive", ({ payload }) =>
        setActiveOrganizationHandler(payload),
      )
      .handle("getFullOrganization", ({ params }) =>
        getFullOrganizationHandler(params),
      )
      .handle("update", ({ payload }) => updateOrganizationHandler(payload)),
);
