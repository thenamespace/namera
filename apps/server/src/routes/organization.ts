import { Effect } from "effect";

import { HttpApiBuilder } from "effect/unstable/httpapi";

import { api } from "@namera-ai/api";
import { AuthRepo } from "@namera-ai/domain";
import {
  OrganizationError,
  type CreateOrganizationRequest,
} from "@namera-ai/schema";

const createOrganizationHandler = (payload: CreateOrganizationRequest) =>
  Effect.gen(function* () {
    const auth = yield* AuthRepo.AuthRepo;

    // Check if slug is available
    const isSlugTaken = yield* auth.organization.checkSlug(payload.slug);

    if (isSlugTaken) {
      return yield* new OrganizationError({
        code: "SLUG_ALREADY_TAKEN",
      });
    }

    const newOrg = yield* auth.organization.createOrganization({
      ...payload,
      plan: "free",
    });

    return newOrg;
  });

export const HealthGroupLive = HttpApiBuilder.group(
  api,
  "organization",
  (handlers) =>
    handlers
      .handle("create", ({ payload }) => createOrganizationHandler(payload))
      .handle("checkSlug", () => Effect.succeed("todo" as any))
      .handle("list", () => Effect.succeed("todo" as any))
      .handle("setActive", () => Effect.succeed("todo" as any))
      .handle("getFullOrganization", () => Effect.succeed("todo" as any))
      .handle("update", () => Effect.succeed("todo" as any))
      .handle("delete", () => Effect.succeed("todo" as any)),
);
