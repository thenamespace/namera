import type { OrganizationId } from "@namera-ai/schema";
import type {
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
} from "@namera-ai/schema/dto";

import { Effect } from "effect";

import { Reactivity } from "effect/unstable/reactivity";

import { annotateDashboardRoute } from "@/actions/telemetry";
import { atomKeys, atomRuntime } from "@/lib/atom";
import { ApiClient } from "@/services";

export const createOrganization = atomRuntime.fn<CreateOrganizationRequest>()(
  Effect.fn("organization.create")(function* (data) {
    yield* annotateDashboardRoute();
    const client = yield* ApiClient.ApiClient;
    const org = yield* client.organization.create({ payload: data });
    yield* Reactivity.invalidate(atomKeys.auth.me);
    yield* Reactivity.invalidate(atomKeys.organization.listUserOrgs);
    return org;
  }),
);

export const listUserOrgs = Effect.fn("organization.list")(function* () {
  yield* annotateDashboardRoute();
  const client = yield* ApiClient.ApiClient;
  const orgs = yield* client.organization.list();
  return orgs;
});

export const switchOrganization = atomRuntime.fn<OrganizationId>()(
  Effect.fn("organization.setActive")(function* (id) {
    yield* annotateDashboardRoute();
    yield* Effect.annotateCurrentSpan("organization.id", id);
    const client = yield* ApiClient.ApiClient;
    yield* client.organization.setActive({ payload: { id } });
    yield* Reactivity.invalidate(atomKeys.auth.me);
  }),
);

export const updateOrganization = atomRuntime.fn<UpdateOrganizationRequest>()(
  Effect.fn("organization.update")(function* (data) {
    yield* annotateDashboardRoute();
    const client = yield* ApiClient.ApiClient;
    const res = yield* client.organization.update({ payload: data });
    yield* Reactivity.invalidate(atomKeys.auth.me);
    return res;
  }),
);
