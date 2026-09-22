import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import type { ListUsersRequest } from "@namera-ai/protocol/dto";

/** Operator-facing reads that have no owning domain of their own. */
export const makeAdminApplication = Effect.gen(function* () {
  const repository = (yield* Repository).auth.user;

  const listUsers = Effect.fn("application.admin.listUsers")(function* (input: ListUsersRequest) {
    const limit = input.limit ?? 50;
    const rows = yield* repository.list({
      ...input,
      limit,
      ...(input.search === undefined ? {} : { search: input.search.trim().toLowerCase() }),
    });
    const entries = rows.slice(0, limit);
    return { entries, nextCursor: rows.length > limit ? (entries.at(-1)?.id ?? null) : null };
  }, Effect.orDie);

  return { listUsers };
});
