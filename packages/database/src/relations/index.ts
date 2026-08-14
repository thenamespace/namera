import { defineRelations } from "drizzle-orm";

import {
  account,
  apiKey,
  actor,
  billingAccount,
  billingProviderEvent,
  billingSubscription,
  emailJob,
  execution,
  invitation,
  notification,
  notificationPreference,
  notificationRecipient,
  organization,
  organizationEvent,
  organizationMember,
  organizationRole,
  session,
  sessionKey,
  sessionKeyGrant,
  sessionKeyPolicyReservation,
  sessionKeyPolicyState,
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
    apiKey,
    actor,
    billingAccount,
    billingProviderEvent,
    billingSubscription,
    emailJob,
    execution,
    invitation,
    notification,
    notificationPreference,
    notificationRecipient,
    organization,
    organizationEvent,
    organizationMember,
    organizationRole,
    session,
    sessionKey,
    sessionKeyGrant,
    sessionKeyPolicyReservation,
    sessionKeyPolicyState,
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
      }),
      apiKey: r.one.apiKey({
        from: [r.actor.id, r.actor.organizationId],
        to: [r.apiKey.actorId, r.apiKey.organizationId],
      }),
      createdApiKeys: r.many.apiKey({
        from: [r.actor.id, r.actor.organizationId],
        to: [r.apiKey.createdByActorId, r.apiKey.organizationId],
      }),
      revokedApiKeys: r.many.apiKey({
        from: [r.actor.id, r.actor.organizationId],
        to: [r.apiKey.revokedByActorId, r.apiKey.organizationId],
      }),
      createdWallets: r.many.wallet({
        from: [r.actor.id, r.actor.organizationId],
        to: [r.wallet.createdByActorId, r.wallet.organizationId],
      }),
      createdSessionKeys: r.many.sessionKey({
        from: [r.actor.id, r.actor.organizationId],
        to: [r.sessionKey.createdByActorId, r.sessionKey.organizationId],
      }),
      revokedSessionKeys: r.many.sessionKey({
        from: [r.actor.id, r.actor.organizationId],
        to: [r.sessionKey.revokedByActorId, r.sessionKey.organizationId],
      }),
      sessionKeyGrants: r.many.sessionKeyGrant({
        from: [r.actor.id, r.actor.organizationId],
        to: [r.sessionKeyGrant.actorId, r.sessionKeyGrant.organizationId],
      }),
      grantedSessionKeyGrants: r.many.sessionKeyGrant({
        from: [r.actor.id, r.actor.organizationId],
        to: [r.sessionKeyGrant.grantedByActorId, r.sessionKeyGrant.organizationId],
      }),
      revokedSessionKeyGrants: r.many.sessionKeyGrant({
        from: [r.actor.id, r.actor.organizationId],
        to: [r.sessionKeyGrant.revokedByActorId, r.sessionKeyGrant.organizationId],
      }),
      auditEvents: r.many.organizationEvent({
        from: [r.actor.id, r.actor.organizationId],
        to: [r.organizationEvent.actorId, r.organizationEvent.organizationId],
      }),
      notifications: r.many.notification({
        from: [r.actor.id, r.actor.organizationId],
        to: [r.notification.actorId, r.notification.organizationId],
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
      notificationRecipients: r.many.notificationRecipient({
        from: r.user.id,
        to: r.notificationRecipient.userId,
      }),
      notificationPreferences: r.many.notificationPreference({
        from: r.user.id,
        to: r.notificationPreference.userId,
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
    apiKey: {
      organization: r.one.organization({
        from: r.apiKey.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      actor: r.one.actor({
        from: [r.apiKey.actorId, r.apiKey.organizationId],
        to: [r.actor.id, r.actor.organizationId],
        optional: false,
      }),
      creator: r.one.actor({
        from: [r.apiKey.createdByActorId, r.apiKey.organizationId],
        to: [r.actor.id, r.actor.organizationId],
        optional: false,
      }),
      revoker: r.one.actor({
        from: [r.apiKey.revokedByActorId, r.apiKey.organizationId],
        to: [r.actor.id, r.actor.organizationId],
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
      apiKeys: r.many.apiKey({
        from: r.organization.id,
        to: r.apiKey.organizationId,
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
      sessionKeys: r.many.sessionKey({
        from: r.organization.id,
        to: r.sessionKey.organizationId,
      }),
      sessionKeyGrants: r.many.sessionKeyGrant({
        from: r.organization.id,
        to: r.sessionKeyGrant.organizationId,
      }),
      sessionKeyPolicyStates: r.many.sessionKeyPolicyState({
        from: r.organization.id,
        to: r.sessionKeyPolicyState.organizationId,
      }),
      sessionKeyPolicyReservations: r.many.sessionKeyPolicyReservation({
        from: r.organization.id,
        to: r.sessionKeyPolicyReservation.organizationId,
      }),
      executions: r.many.execution({
        from: r.organization.id,
        to: r.execution.organizationId,
      }),
      auditEvents: r.many.organizationEvent({
        from: r.organization.id,
        to: r.organizationEvent.organizationId,
      }),
      notifications: r.many.notification({
        from: r.organization.id,
        to: r.notification.organizationId,
      }),
      notificationPreferences: r.many.notificationPreference({
        from: r.organization.id,
        to: r.notificationPreference.organizationId,
      }),
      billingAccount: r.one.billingAccount({
        from: r.organization.id,
        to: r.billingAccount.organizationId,
      }),
      billingSubscriptions: r.many.billingSubscription({
        from: r.organization.id,
        to: r.billingSubscription.organizationId,
      }),
    },
    billingAccount: {
      organization: r.one.organization({
        from: r.billingAccount.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      subscriptions: r.many.billingSubscription({
        from: r.billingAccount.organizationId,
        to: r.billingSubscription.organizationId,
      }),
    },
    billingSubscription: {
      account: r.one.billingAccount({
        from: r.billingSubscription.organizationId,
        to: r.billingAccount.organizationId,
        optional: false,
      }),
      organization: r.one.organization({
        from: r.billingSubscription.organizationId,
        to: r.organization.id,
        optional: false,
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
      sessionKeys: r.many.sessionKey({
        from: [r.wallet.id, r.wallet.organizationId],
        to: [r.sessionKey.walletId, r.sessionKey.organizationId],
      }),
    },
    sessionKey: {
      organization: r.one.organization({
        from: r.sessionKey.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      wallet: r.one.wallet({
        from: [r.sessionKey.walletId, r.sessionKey.organizationId],
        to: [r.wallet.id, r.wallet.organizationId],
        optional: false,
      }),
      creator: r.one.actor({
        from: [r.sessionKey.createdByActorId, r.sessionKey.organizationId],
        to: [r.actor.id, r.actor.organizationId],
        optional: false,
      }),
      revoker: r.one.actor({
        from: [r.sessionKey.revokedByActorId, r.sessionKey.organizationId],
        to: [r.actor.id, r.actor.organizationId],
      }),
      grants: r.many.sessionKeyGrant({
        from: [r.sessionKey.id, r.sessionKey.organizationId],
        to: [r.sessionKeyGrant.sessionKeyId, r.sessionKeyGrant.organizationId],
      }),
      policyStates: r.many.sessionKeyPolicyState({
        from: [r.sessionKey.id, r.sessionKey.organizationId],
        to: [r.sessionKeyPolicyState.sessionKeyId, r.sessionKeyPolicyState.organizationId],
      }),
      policyReservations: r.many.sessionKeyPolicyReservation({
        from: [r.sessionKey.id, r.sessionKey.organizationId],
        to: [
          r.sessionKeyPolicyReservation.sessionKeyId,
          r.sessionKeyPolicyReservation.organizationId,
        ],
      }),
    },
    sessionKeyGrant: {
      organization: r.one.organization({
        from: r.sessionKeyGrant.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      actor: r.one.actor({
        from: [r.sessionKeyGrant.actorId, r.sessionKeyGrant.organizationId],
        to: [r.actor.id, r.actor.organizationId],
        optional: false,
      }),
      sessionKey: r.one.sessionKey({
        from: [r.sessionKeyGrant.sessionKeyId, r.sessionKeyGrant.organizationId],
        to: [r.sessionKey.id, r.sessionKey.organizationId],
        optional: false,
      }),
      grantedBy: r.one.actor({
        from: [r.sessionKeyGrant.grantedByActorId, r.sessionKeyGrant.organizationId],
        to: [r.actor.id, r.actor.organizationId],
        optional: false,
      }),
      revokedBy: r.one.actor({
        from: [r.sessionKeyGrant.revokedByActorId, r.sessionKeyGrant.organizationId],
        to: [r.actor.id, r.actor.organizationId],
      }),
      executions: r.many.execution({
        from: [r.sessionKeyGrant.id, r.sessionKeyGrant.organizationId],
        to: [r.execution.sessionKeyGrantId, r.execution.organizationId],
      }),
    },
    execution: {
      organization: r.one.organization({
        from: r.execution.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      sessionKeyGrant: r.one.sessionKeyGrant({
        from: [r.execution.sessionKeyGrantId, r.execution.organizationId],
        to: [r.sessionKeyGrant.id, r.sessionKeyGrant.organizationId],
        optional: false,
      }),
    },
    sessionKeyPolicyState: {
      organization: r.one.organization({
        from: r.sessionKeyPolicyState.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      sessionKey: r.one.sessionKey({
        from: [r.sessionKeyPolicyState.sessionKeyId, r.sessionKeyPolicyState.organizationId],
        to: [r.sessionKey.id, r.sessionKey.organizationId],
        optional: false,
      }),
    },
    sessionKeyPolicyReservation: {
      organization: r.one.organization({
        from: r.sessionKeyPolicyReservation.organizationId,
        to: r.organization.id,
        optional: false,
      }),
      sessionKey: r.one.sessionKey({
        from: [
          r.sessionKeyPolicyReservation.sessionKeyId,
          r.sessionKeyPolicyReservation.organizationId,
        ],
        to: [r.sessionKey.id, r.sessionKey.organizationId],
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
    emailJob: {
      notificationRecipient: r.one.notificationRecipient({
        from: r.emailJob.id,
        to: r.notificationRecipient.emailJobId,
      }),
    },
    notification: {
      organization: r.one.organization({
        from: r.notification.organizationId,
        to: r.organization.id,
      }),
      actor: r.one.actor({
        from: [r.notification.actorId, r.notification.organizationId],
        to: [r.actor.id, r.actor.organizationId],
      }),
      recipients: r.many.notificationRecipient({
        from: r.notification.id,
        to: r.notificationRecipient.notificationId,
      }),
    },
    notificationRecipient: {
      notification: r.one.notification({
        from: r.notificationRecipient.notificationId,
        to: r.notification.id,
        optional: false,
      }),
      user: r.one.user({
        from: r.notificationRecipient.userId,
        to: r.user.id,
        optional: false,
      }),
      emailJob: r.one.emailJob({
        from: r.notificationRecipient.emailJobId,
        to: r.emailJob.id,
      }),
    },
    notificationPreference: {
      user: r.one.user({
        from: r.notificationPreference.userId,
        to: r.user.id,
        optional: false,
      }),
      organization: r.one.organization({
        from: r.notificationPreference.organizationId,
        to: r.organization.id,
      }),
    },
  }),
);
