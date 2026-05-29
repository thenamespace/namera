import { Effect, Schema } from "effect";

import { HttpApiBuilder } from "effect/unstable/httpapi";

import { createOrganization } from "@/common";
import { api, CurrentActor } from "@namera-ai/api";
import { AdminDatabase, Database, Transaction } from "@namera-ai/database";
import * as AuthRepo from "@namera-ai/domain/auth";
import { mapToDatabaseError, mapToInternalError } from "@namera-ai/schema";
import {
  GetOrganizationRequest,
  GetOrganizationResponse,
  OrganizationError,
  UpdateOrganizationRequest,
  type CreateOrganizationRequest,
  type SetActiveOrganizationRequest,
} from "@namera-ai/schema/dto";

const createOrganizationHandler = (payload: CreateOrganizationRequest) =>
  Effect.gen(function* () {
    const currentUser = yield* CurrentActor;
    const db = yield* AdminDatabase.AdminDatabase;

    const res = yield* db.transaction((tx) =>
      Effect.gen(function* () {
        return yield* createOrganization({
          payload: payload,
          userId: currentUser.user.id,
          sessionId: currentUser.session.id,
        });
      }).pipe(Transaction.withTx(tx)),
    );

    return res;
  }).pipe(mapToDatabaseError, mapToInternalError);

const listOrgsHandler = Effect.fn("listOrgs")(
  function* () {
    const currentUser = yield* CurrentActor;
    const auth = yield* AuthRepo.AuthRepo;
    const db = yield* Database.Database;

    const res = yield* db.transaction((tx) =>
      Effect.gen(function* () {
        yield* Transaction.setActorContext({
          actorType: "user",
          userId: currentUser.user.id,
        });
        return yield* auth.organization.listUserOrgs(currentUser.user.id);
      }).pipe(Transaction.withTx(tx)),
    );

    return res;
  },
  mapToDatabaseError,
  mapToInternalError,
);

const setActiveOrganizationHandler = (payload: SetActiveOrganizationRequest) =>
  Effect.gen(function* () {
    const currentUser = yield* CurrentActor;
    const auth = yield* AuthRepo.AuthRepo;
    const db = yield* Database.Database;

    return yield* db.transaction((tx) =>
      Effect.gen(function* () {
        yield* Transaction.setActorContext({
          actorType: "user",
          userId: currentUser.user.id,
        });
        const isMember = yield* auth.organization.hasActiveMembership(
          currentUser.user.id,
          payload.id,
        );

        yield* Effect.log("isMember", isMember);

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
  }).pipe(mapToDatabaseError, mapToInternalError);

const getOrganizationHandler = (params: GetOrganizationRequest) =>
  Effect.gen(function* () {
    const currentUser = yield* CurrentActor;
    const auth = yield* AuthRepo.AuthRepo;
    const db = yield* AdminDatabase.AdminDatabase;

    const res = yield* db.transaction((tx) =>
      Effect.gen(function* () {
        yield* Transaction.setActorContext({
          actorType: "user",
          userId: currentUser.user.id,
        });
        return yield* auth.organization.get(params);
      }).pipe(Transaction.withTx(tx)),
    );

    return Schema.decodeUnknownSync(GetOrganizationResponse)(res);
  }).pipe(mapToDatabaseError, mapToInternalError);

const updateOrganizationHandler = (payload: UpdateOrganizationRequest) =>
  Effect.gen(function* () {
    const currentUser = yield* CurrentActor;
    const auth = yield* AuthRepo.AuthRepo;
    const db = yield* AdminDatabase.AdminDatabase;

    const org = currentUser.organization;

    if (!org) {
      return yield* new OrganizationError({
        code: "ORGANIZATION_NOT_FOUND",
      });
    }

    return yield* db.transaction((tx) =>
      Effect.gen(function* () {
        yield* Transaction.setActorContext({
          actorType: "user",
          userId: currentUser.user.id,
        });
        return yield* auth.organization.updateOrganization(
          currentUser.user.id,
          org.id,
          payload,
        );
      }).pipe(Transaction.withTx(tx)),
    );
  }).pipe(mapToDatabaseError, mapToInternalError);

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
      .handle("getOrganization", ({ params }) => getOrganizationHandler(params))
      .handle("update", ({ payload }) => updateOrganizationHandler(payload)),
);
