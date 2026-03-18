import { createServerFn } from "@tanstack/react-start";

import { Effect } from "effect";

import { ApiClient } from "@/layers/api";
import { serverRuntime } from "@/runtime/server";

export const listSmartAccounts = createServerFn({ method: "GET" }).handler(() =>
  serverRuntime.runPromise(
    Effect.gen(function* () {
      const client = yield* ApiClient;
      return yield* client.smartAccount.list();
    }).pipe(Effect.withSpan("listSmartAccounts")),
  ),
);
