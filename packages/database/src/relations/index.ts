import { defineRelations } from "drizzle-orm";

import { account, session, smartAccount, user, verification } from "../schema";

export const relations = defineRelations(
  { account, session, user, verification, smartAccount },
  (r) => ({
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
    user: {
      accounts: r.many.account(),
      sessions: r.many.session(),
      smartAccounts: r.many.smartAccount(),
    },
    verification: {},
    smartAccount: {
      user: r.one.user({
        from: r.smartAccount.userId,
        to: r.user.id,
      }),
    },
  }),
);
