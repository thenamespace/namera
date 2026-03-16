import { defineRelations } from "drizzle-orm";

import {
  account,
  session,
  sessionKey,
  smartAccount,
  user,
  verification,
} from "../schema";

export const relations = defineRelations(
  { account, session, user, verification, smartAccount, sessionKey },
  (r) => ({
    account: {
      // 1 account can have one user
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
      }),
    },
    session: {
      // 1 session can have one user
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
    },
    user: {
      // 1 user can have many accounts
      accounts: r.many.account(),
      // 1 user can have many sessions
      sessions: r.many.session(),
      // 1 user can have many smart accounts
      smartAccounts: r.many.smartAccount(),
      // 1 user can have many session keys
      sessionKeys: r.many.sessionKey(),
    },
    verification: {},
    smartAccount: {
      // one smart account can have one user
      user: r.one.user({
        from: r.smartAccount.userId,
        to: r.user.id,
      }),
      // one smart account can have many session keys
      sessionKeys: r.many.sessionKey({
        from: r.smartAccount.id,
        to: r.sessionKey.smartAccountId,
      }),
    },
  }),
);
