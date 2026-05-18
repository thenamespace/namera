import { defineRelations } from "drizzle-orm";

import {
  account,
  invitation,
  member,
  organization,
  role,
  session,
  sessionKey,
  smartAccount,
  user,
  verification,
} from "../schema";

export const relations = defineRelations(
  {
    account,
    session,
    user,
    verification,
    smartAccount,
    sessionKey,
    organization,
    invitation,
    member,
    role,
  },
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
      // 1 user can have many invitations
      invitations: r.many.invitation(),
      // 1 user can be member of many organizations
      members: r.many.member(),
    },
    verification: {},
    organization: {
      // 1 organization can have many invitations
      invitations: r.many.invitation(),
      // 1 organization can have many members
      members: r.many.member(),
      // 1 organization can have many smart accounts
      smartAccounts: r.many.smartAccount(),
      // 1 organization can have many session keys
      sessionKeys: r.many.sessionKey(),
      // 1 organization can have many roles
      roles: r.many.role(),
    },
    member: {
      // 1 member can have one organization
      organization: r.one.organization({
        from: r.member.organizationId,
        to: r.organization.id,
      }),
      // 1 member maps to one user
      user: r.one.user({
        from: r.member.userId,
        to: r.user.id,
      }),
      role: r.one.role({
        from: r.member.roleId,
        to: r.role.id,
      }),
    },
    invitation: {
      // 1 invitation belongs to one organization
      organization: r.one.organization({
        from: r.invitation.organizationId,
        to: r.organization.id,
      }),
      // 1 invitation can have one inviter
      user: r.one.user({
        from: r.invitation.inviterId,
        to: r.user.id,
      }),
      // 1 invitation can have one role
      role: r.one.role({
        from: r.invitation.roleId,
        to: r.role.id,
      }),
    },
    role: {
      organization: r.one.organization({
        from: r.role.organizationId,
        to: r.organization.id,
      }),
      members: r.many.member({
        from: r.role.id,
        to: r.member.roleId,
      }),
      invitations: r.many.invitation({
        from: r.role.id,
        to: r.invitation.roleId,
      }),
    },
    smartAccount: {
      // one smart account belongs to one organization
      organization: r.one.organization({
        from: r.smartAccount.organizationId,
        to: r.organization.id,
      }),
      // one smart account has one creator
      creator: r.one.user({
        from: r.smartAccount.creatorId,
        to: r.user.id,
      }),
      // one smart account can have many session keys
      sessionKeys: r.many.sessionKey({
        from: r.smartAccount.id,
        to: r.sessionKey.smartAccountId,
      }),
    },
    sessionKey: {
      // one session key belongs to one organization
      organization: r.one.organization({
        from: r.sessionKey.organizationId,
        to: r.organization.id,
      }),
      // one session key can have one creator
      creator: r.one.user({
        from: r.sessionKey.creatorId,
        to: r.user.id,
      }),
      // one session key can have one smart account
      smartAccount: r.one.smartAccount({
        from: r.sessionKey.smartAccountId,
        to: r.smartAccount.id,
      }),
    },
  }),
);
