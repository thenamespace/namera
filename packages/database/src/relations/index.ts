import { defineRelations } from "drizzle-orm";

import {
  account,
  actor,
  emailJob,
  invitation,
  organization,
  organizationEvent,
  organizationMember,
  organizationRole,
  session,
  systemRole,
  user,
  userEvent,
  verification,
  wallet,
  walletKey,
} from "../schema/index.js";

export const relations = defineRelations(
  {
    account,
    actor,
    emailJob,
    invitation,
    organization,
    organizationEvent,
    organizationMember,
    organizationRole,
    session,
    systemRole,
    user,
    userEvent,
    verification,
    wallet,
    walletKey,
  },
  (r) => ({
    actor: {
      organization: r.one.organization({
        from: r.actor.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      organizationMember: r.one.organizationMember({
        from: r.actor.id,
        to: r.organizationMember.actorId,
        optional: false,
      }),
      createdWallets: r.many.wallet({
        from: [r.actor.id, r.actor.organizationId],
        to: [r.wallet.createdByActorId, r.wallet.organizationId],
      }),
      auditEvents: r.many.organizationEvent({
        from: [r.actor.id, r.actor.organizationId],
        to: [r.organizationEvent.actorId, r.organizationEvent.organizationId],
      }),
    },
    user: {
      // One user can have many active or historical sessions.
      sessions: r.many.session({ from: r.user.id, to: r.session.userId }),
      // One user can have many linked OAuth, passkey, or credential accounts.
      accounts: r.many.account({ from: r.user.id, to: r.account.userId }),
      // One user can create many organizations.
      createdOrganizations: r.many.organization({
        from: r.user.id,
        to: r.organization.createdById,
      }),
      // One user can be a member of many organizations.
      organizationMemberships: r.many.organizationMember({
        from: r.user.id,
        to: r.organizationMember.userId,
      }),
      // One user can send many organization invitations.
      sentInvitations: r.many.invitation({
        from: r.user.id,
        to: r.invitation.inviterId,
      }),
      auditEvents: r.many.userEvent({
        from: r.user.id,
        to: r.userEvent.userId,
      }),
    },
    session: {
      // Each session belongs to one user.
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
        optional: false,
      }),
      // Each session can optionally be scoped to one active organization.
      activeOrganization: r.one.organization({
        from: r.session.activeOrganizationId,
        to: r.organization.id,
      }),
    },
    account: {
      // Each linked account belongs to one user.
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
        optional: false,
      }),
    },
    organization: {
      // Each organization has one creating user.
      creator: r.one.user({
        from: r.organization.createdById,
        to: r.user.id,
        optional: false,
      }),
      // One organization can be active in many user sessions.
      activeSessions: r.many.session({
        from: r.organization.id,
        to: r.session.activeOrganizationId,
      }),
      // One organization can define many organization roles.
      organizationRoles: r.many.organizationRole({
        from: r.organization.id,
        to: r.organizationRole.organizationId,
      }),
      // One organization can have many organization members.
      organizationMembers: r.many.organizationMember({
        from: r.organization.id,
        to: r.organizationMember.organizationId,
      }),
      actors: r.many.actor({
        from: r.organization.id,
        to: r.actor.organizationId,
      }),
      // One organization can have many invitations.
      invitations: r.many.invitation({
        from: r.organization.id,
        to: r.invitation.organizationId,
      }),
      walletKeys: r.many.walletKey({
        from: r.organization.id,
        to: r.walletKey.organizationId,
      }),
      wallets: r.many.wallet({
        from: r.organization.id,
        to: r.wallet.organizationId,
      }),
      auditEvents: r.many.organizationEvent({
        from: r.organization.id,
        to: r.organizationEvent.organizationId,
      }),
    },
    systemRole: {
      // One system role can be attached to many organization roles.
      organizationRoles: r.many.organizationRole({
        from: r.systemRole.id,
        to: r.organizationRole.systemRoleId,
      }),
    },
    organizationRole: {
      // Each organization role belongs to one organization.
      organization: r.one.organization({
        from: r.organizationRole.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      // A system organization role maps to one predefined system role template.
      systemRole: r.one.systemRole({
        from: r.organizationRole.systemRoleId,
        to: r.systemRole.id,
      }),
      // One organization role can be assigned to many organization members.
      organizationMembers: r.many.organizationMember({
        from: r.organizationRole.id,
        to: r.organizationMember.organizationRoleId,
      }),
      // One organization role can be assigned through many invitations.
      invitations: r.many.invitation({
        from: r.organizationRole.id,
        to: r.invitation.organizationRoleId,
      }),
    },
    organizationMember: {
      actor: r.one.actor({
        from: r.organizationMember.actorId,
        to: r.actor.id,
        optional: false,
      }),
      // Each membership connects one user.
      user: r.one.user({
        from: r.organizationMember.userId,
        to: r.user.id,
        optional: false,
      }),
      // Each membership connects one organization.
      organization: r.one.organization({
        from: r.organizationMember.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      // Each membership has one assigned organization role.
      organizationRole: r.one.organizationRole({
        from: r.organizationMember.organizationRoleId,
        to: r.organizationRole.id,
        optional: false,
      }),
    },
    invitation: {
      // Each invitation targets one organization.
      organization: r.one.organization({
        from: r.invitation.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      // Each invitation grants one organization role when accepted.
      organizationRole: r.one.organizationRole({
        from: r.invitation.organizationRoleId,
        to: r.organizationRole.id,
        optional: false,
      }),
      // Each invitation is sent by one user.
      inviter: r.one.user({
        from: r.invitation.inviterId,
        to: r.user.id,
        optional: false,
      }),
    },
    walletKey: {
      organization: r.one.organization({
        from: r.walletKey.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      wallets: r.many.wallet({
        from: [r.walletKey.id, r.walletKey.organizationId],
        to: [r.wallet.walletKeyId, r.wallet.organizationId],
      }),
    },
    wallet: {
      organization: r.one.organization({
        from: r.wallet.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      walletKey: r.one.walletKey({
        from: [r.wallet.walletKeyId, r.wallet.organizationId],
        to: [r.walletKey.id, r.walletKey.organizationId],
        optional: false,
      }),
      creator: r.one.actor({
        from: [r.wallet.createdByActorId, r.wallet.organizationId],
        to: [r.actor.id, r.actor.organizationId],
        optional: false,
      }),
    },
    userEvent: {
      user: r.one.user({
        from: r.userEvent.userId,
        to: r.user.id,
        optional: false,
      }),
    },
    organizationEvent: {
      organization: r.one.organization({
        from: r.organizationEvent.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      actor: r.one.actor({
        from: [r.organizationEvent.actorId, r.organizationEvent.organizationId],
        to: [r.actor.id, r.actor.organizationId],
      }),
    },
  }),
);
