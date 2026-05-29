import type { OrganizationId } from "@namera-ai/schema";
import type {
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
} from "@namera-ai/schema/dto";

import { Effect } from "effect";

import { clientRuntime } from "@/lib/runtime";
import { ApiClient } from "@/services";

export const createOrganization = async (data: CreateOrganizationRequest) =>
  clientRuntime.runPromise(
    Effect.gen(function* () {
      const client = yield* ApiClient.ApiClient;
      const org = yield* client.organization.create({ payload: data });
      return org;
    }),
  );

export const listUserOrgs = async () =>
  clientRuntime.runPromise(
    Effect.fn("listUserOrgs")(function* () {
      const client = yield* ApiClient.ApiClient;
      const orgs = yield* client.organization.list();
      return orgs;
    })(),
  );

export const switchOrganization = async (id: OrganizationId) =>
  clientRuntime.runPromise(
    Effect.gen(function* () {
      const client = yield* ApiClient.ApiClient;
      yield* client.organization.setActive({ payload: { id } });
    }),
  );

export const updateOrganization = async (data: UpdateOrganizationRequest) =>
  clientRuntime.runPromise(
    Effect.gen(function* () {
      const client = yield* ApiClient.ApiClient;
      return yield* client.organization.update({ payload: data });
    }),
  );
