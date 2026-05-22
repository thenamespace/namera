import type { CreateOrganizationRequest } from "@namera-ai/schema";

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
