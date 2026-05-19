import { Effect } from "effect";

import { HttpApiBuilder } from "effect/unstable/httpapi";

import { api, AuthenticatedUser } from "@namera-ai/api";
import { AdminDatabase, Transaction } from "@namera-ai/database";
import { AuthRepo } from "@namera-ai/domain";
import {
  CheckOrganizationSlugRequest,
  OrganizationError,
  type CreateOrganizationRequest,
} from "@namera-ai/schema";

const createOrganizationHandler = (payload: CreateOrganizationRequest) =>
  Effect.gen(function* () {
    const currentUser = yield* AuthenticatedUser;
    const auth = yield* AuthRepo.AuthRepo;

    const db = yield* AdminDatabase.AdminDatabase;

    const res = yield* db
      .transaction((tx) =>
        Effect.gen(function* () {
          const orgsCreatedByUser =
            yield* auth.organization.listOrgsCreatedByUser(currentUser.user.id);

          if (orgsCreatedByUser.length >= 3) {
            return yield* new OrganizationError({
              code: "ORG_LIMIT_REACHED",
            });
          }

          const isSlugTaken = yield* auth.organization.checkSlug(payload.slug);

          if (isSlugTaken) {
            return yield* new OrganizationError({
              code: "SLUG_ALREADY_TAKEN",
            });
          }

          const newOrg = yield* auth.organization.createOrganization({
            ...payload,
            plan: "free",
            createdById: currentUser.user.id,
          });

          return newOrg;
        }).pipe(Transaction.withTx(tx)),
      )
      .pipe(Effect.orDie);

    return res;
  });

const checkSlugHandler = ({ slug }: CheckOrganizationSlugRequest) =>
  Effect.gen(function* () {
    const db = yield* AdminDatabase.AdminDatabase;
    const auth = yield* AuthRepo.AuthRepo;

    const isSlugTaken = yield* db
      .transaction((tx) =>
        Effect.gen(function* () {
          return yield* auth.organization.checkSlug(slug);
        }).pipe(Transaction.withTx(tx)),
      )
      .pipe(Effect.orDie);

    return { isAvailable: !isSlugTaken };
  });

const listOrgsHandler = () =>
  Effect.gen(function* () {
    const currentUser = yield* AuthenticatedUser;
    const auth = yield* AuthRepo.AuthRepo;

    const res = yield* auth.organization.list(currentUser.user.id);

    return res;
  });

export const HealthGroupLive = HttpApiBuilder.group(
  api,
  "organization",
  (handlers) =>
    handlers
      .handle("create", ({ payload }) => createOrganizationHandler(payload))
      .handle("checkSlug", ({ payload }) => checkSlugHandler(payload))
      .handle("list", () => listOrgsHandler())
      .handle("setActive", () => Effect.succeed("todo" as any))
      .handle("getFullOrganization", () => Effect.succeed("todo" as any))
      .handle("update", () => Effect.succeed("todo" as any))
      .handle("delete", () => Effect.succeed("todo" as any)),
);
