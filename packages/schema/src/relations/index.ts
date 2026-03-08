import { defineRelations } from "drizzle-orm";

import { account, session, user, verification } from "../schema";

export const relations = defineRelations(
  { user, account, session, verification },
  (r) => ({
    user: {
      accounts: r.many.account(),
      sessions: r.many.session(),
    },
    account: {
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
      }),
    },
    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
    },
    verification: {},
  }),
);
