import type {
  CreateSmartAccountRequest,
  SmartAccount,
} from "@namera-ai/schema";

import { Effect } from "effect";

import { clientRuntime } from "@/lib/runtime";
import { ApiClient } from "@/services";

export const listSmartAccounts = async () =>
  clientRuntime.runPromise(
    Effect.gen(function* () {
      const client = yield* ApiClient.ApiClient;
      const res = yield* client.smartAccount.listSmartAccounts();
      return res;
    }).pipe(Effect.catch(() => Effect.succeed([] as SmartAccount[]))),
  );

export const createSmartAccount = async (data: CreateSmartAccountRequest) =>
  clientRuntime.runPromise(
    Effect.gen(function* () {
      const client = yield* ApiClient.ApiClient;

      return yield* client.smartAccount.createSmartAccount({
        payload: data,
      });
    }).pipe(Effect.catchTag("Unauthorized", () => Effect.succeed(null))),
  );
