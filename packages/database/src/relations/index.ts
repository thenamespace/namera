import { defineRelations } from "drizzle-orm";

import {
  account,
  invitation,
  member,
  organization,
  organizationEvent,
  role,
  session,
  sessionKey,
  smartAccount,
  user,
  userPreferences,
  verification,
  systemRole,
  userEvent,
} from "../schema";

export const relations = defineRelations(
  {
    account,
    session,
    systemRole,
    user,
    verification,
    smartAccount,
    sessionKey,
    organization,
    invitation,
    member,
    role,
    organizationEvent,
    userEvent,
    userPreferences,
  },
  (r) => ({
    user: {
      // 1 user can have many accounts
      accounts: r.many.account(),
      // 1 user can have many sessions
      sessions: r.many.session(),
      // 1 user can have many invitations
      invitations: r.many.invitation(),
      // 1 user can be member of many organizations
      members: r.many.member(),
      // 1 user can have 1 user preference
      userPreferences: r.one.userPreferences(),
      // 1 user can have many events
      events: r.many.userEvent(),
    },
    session: {
      // 1 session can have one organization
      organization: r.one.organization({
        from: r.session.activeOrganizationId,
        to: r.organization.id,
      }),
      // 1 session can have one user
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
    },
    account: {
      // 1 account can have one user
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
      }),
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
      // 1 org can have many events
      events: r.many.organizationEvent(),
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
      // 1 member can have one role
      role: r.one.role({
        from: r.member.roleId,
        to: r.role.id,
      }),
      // 1 member can have multiple smart accounts
      smartAccounts: r.many.smartAccount(),
      // 1 member can have many session keys
      sessionKeys: r.many.sessionKey(),
    },
    role: {
      // 1 role can have one organization
      organization: r.one.organization({
        from: r.role.organizationId,
        to: r.organization.id,
      }),
      // 1 role can have many members
      members: r.many.member({
        from: r.role.id,
        to: r.member.roleId,
      }),
      // 1 role can have many invitations
      invitations: r.many.invitation({
        from: r.role.id,
        to: r.invitation.roleId,
      }),
      // 1 role can have a system role.
      systemRole: r.one.systemRole({
        from: r.role.systemRoleId,
        to: r.systemRole.id,
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
    organizationEvent: {
      // 1 org event belongs to one organization
      organization: r.one.organization({
        from: r.organizationEvent.organizationId,
        to: r.organization.id,
      }),
    },
    userPreference: {
      // 1 user preference can have one user
      user: r.one.user({
        from: r.userPreferences.userId,
        to: r.user.id,
      }),
    },
    userEvent: {
      // 1 user event can have one user
      user: r.one.user({
        from: r.userEvent.userId,
        to: r.user.id,
      }),
    },
    smartAccount: {
      // one smart account belongs to one organization
      organization: r.one.organization({
        from: r.smartAccount.organizationId,
        to: r.organization.id,
      }),
      // one smart account has one creator
      creator: r.one.member({
        from: r.smartAccount.creatorId,
        to: r.member.id,
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
      creator: r.one.member({
        from: r.smartAccount.creatorId,
        to: r.member.id,
      }),
      // one session key can have one smart account
      smartAccount: r.one.smartAccount({
        from: r.sessionKey.smartAccountId,
        to: r.smartAccount.id,
      }),
    },
  }),
);
