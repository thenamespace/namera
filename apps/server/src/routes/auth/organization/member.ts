import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceCurrentUser, toMemberResponse } from "#/helpers/index";

export const MemberRoutes = HttpApiBuilder.group(NameraApi, "member", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;
    return handlers.handle("listOrgMembers", () =>
      Effect.gen(function* () {
        const data = yield* enforceCurrentUser(["member:read"]);
        return (yield* app.organization.member.listMembers(data.organization.id)).map(
          toMemberResponse,
        );
      }),
    );
  }),
);
