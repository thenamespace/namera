import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import { OrganizationService } from "@namera-ai/application";

import { enforceActor, toMemberResponse } from "#/helpers/index";

export const MemberRoutes = HttpApiBuilder.group(NameraApi, "member", (handlers) =>
  Effect.gen(function* () {
    const organizations = yield* OrganizationService;
    return handlers.handle("listOrgMembers", () =>
      Effect.gen(function* () {
        const actor = yield* CurrentActor;
        const data = yield* enforceActor({
          actor,
          allowedActors: ["user"],
          requiredPermissions: { user: ["member:list"] },
        });
        return (yield* organizations.listMembers(data.organization.id)).map(toMemberResponse);
      }),
    );
  }),
);
