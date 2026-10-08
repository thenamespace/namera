import { defineRelationsPart } from "drizzle-orm";

import * as schema from "#/schema/index";

export const authRelations = defineRelationsPart(schema, (r) => ({
  platformMember: {
    // Platform access belongs to an identity, never a tenant actor.
    user: r.one.user({ from: r.platformMember.userId, to: r.user.id, optional: false }),
  },
  platformInvitation: {
    // Keep the issuing member and accepting identity for historical attribution.
    inviter: r.one.platformMember({
      from: r.platformInvitation.invitedByMemberId,
      to: r.platformMember.id,
      optional: false,
    }),
    acceptedUser: r.one.user({ from: r.platformInvitation.acceptedByUserId, to: r.user.id }),
  },
  betaInvite: {
    // A redeemed invite identifies the verified account it admitted.
    redeemedUser: r.one.user({ from: r.betaInvite.redeemedBy, to: r.user.id }),
  },
  actor: {
    // Each actor belongs to one organization.
    organization: r.one.organization({
      from: r.actor.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // A user actor can represent one organization member.
    organizationMember: r.one.organizationMember({
      from: r.actor.id,
      to: r.organizationMember.actorId,
    }),
    // An API-key actor can own one API-key credential.
    apiKey: r.one.apiKey({
      from: [r.actor.id, r.actor.organizationId],
      to: [r.apiKey.actorId, r.apiKey.organizationId],
    }),
    // One actor can create many API keys.
    createdApiKeys: r.many.apiKey({
      from: [r.actor.id, r.actor.organizationId],
      to: [r.apiKey.createdByActorId, r.apiKey.organizationId],
    }),
    // One actor can revoke many API keys.
    revokedApiKeys: r.many.apiKey({
      from: [r.actor.id, r.actor.organizationId],
      to: [r.apiKey.revokedByActorId, r.apiKey.organizationId],
    }),
    // One actor can create many wallets.
    createdWallets: r.many.wallet({
      from: [r.actor.id, r.actor.organizationId],
      to: [r.wallet.createdByActorId, r.wallet.organizationId],
    }),
    // One actor can create many session keys.
    createdSessionKeys: r.many.sessionKey({
      from: [r.actor.id, r.actor.organizationId],
      to: [r.sessionKey.createdByActorId, r.sessionKey.organizationId],
    }),
    // One actor can revoke many session keys.
    revokedSessionKeys: r.many.sessionKey({
      from: [r.actor.id, r.actor.organizationId],
      to: [r.sessionKey.revokedByActorId, r.sessionKey.organizationId],
    }),
    // One actor can receive many session-key grants.
    sessionKeyGrants: r.many.sessionKeyGrant({
      from: [r.actor.id, r.actor.organizationId],
      to: [r.sessionKeyGrant.actorId, r.sessionKeyGrant.organizationId],
    }),
    // One actor can submit many executions.
    executionSubmissions: r.many.executionSubmission({
      from: [r.actor.id, r.actor.organizationId],
      to: [r.executionSubmission.actorId, r.executionSubmission.organizationId],
    }),
    // One actor can issue many session-key grants.
    grantedSessionKeyGrants: r.many.sessionKeyGrant({
      from: [r.actor.id, r.actor.organizationId],
      to: [r.sessionKeyGrant.grantedByActorId, r.sessionKeyGrant.organizationId],
    }),
    // One actor can revoke many session-key grants.
    revokedSessionKeyGrants: r.many.sessionKeyGrant({
      from: [r.actor.id, r.actor.organizationId],
      to: [r.sessionKeyGrant.revokedByActorId, r.sessionKeyGrant.organizationId],
    }),
    // One actor can be attributed to many organization audit events.
    auditEvents: r.many.organizationEvent({
      from: [r.actor.id, r.actor.organizationId],
      to: [r.organizationEvent.actorId, r.organizationEvent.organizationId],
    }),
    // One actor can be attributed to many notifications.
    notifications: r.many.notification({
      from: [r.actor.id, r.actor.organizationId],
      to: [r.notification.actorId, r.notification.organizationId],
    }),
    // A delegated actor can own one OAuth authorization.
    oauthAuthorization: r.one.oauthAuthorization({
      from: [r.actor.id, r.actor.organizationId],
      to: [r.oauthAuthorization.actorId, r.oauthAuthorization.organizationId],
    }),
    // One user actor can approve many OAuth authorizations.
    authorizedOAuthAuthorizations: r.many.oauthAuthorization({
      from: [r.actor.id, r.actor.organizationId],
      to: [r.oauthAuthorization.authorizedByActorId, r.oauthAuthorization.organizationId],
    }),
    // One user actor can revoke many OAuth authorizations.
    revokedOAuthAuthorizations: r.many.oauthAuthorization({
      from: [r.actor.id, r.actor.organizationId],
      to: [r.oauthAuthorization.revokedByActorId, r.oauthAuthorization.organizationId],
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
    // One user can have many user audit events.
    auditEvents: r.many.userEvent({ from: r.user.id, to: r.userEvent.userId }),
    // One user can receive many notifications.
    notificationRecipients: r.many.notificationRecipient({
      from: r.user.id,
      to: r.notificationRecipient.userId,
    }),
    // One user can define many notification preferences.
    notificationPreferences: r.many.notificationPreference({
      from: r.user.id,
      to: r.notificationPreference.userId,
    }),
    // One user can approve or deny many OAuth authorization requests.
    oauthAuthorizationRequests: r.many.oauthAuthorizationRequest({
      from: r.user.id,
      to: r.oauthAuthorizationRequest.userId,
    }),
  },
  session: {
    // Each session belongs to one user.
    user: r.one.user({ from: r.session.userId, to: r.user.id, optional: false }),
    // Each session can optionally select one active organization.
    activeOrganization: r.one.organization({
      from: r.session.activeOrganizationId,
      to: r.organization.id,
    }),
  },
  account: {
    // Each linked account belongs to one user.
    user: r.one.user({ from: r.account.userId, to: r.user.id, optional: false }),
  },
  apiKey: {
    // Each API key belongs to one organization.
    organization: r.one.organization({
      from: r.apiKey.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each API key owns one organization-scoped actor.
    actor: r.one.actor({
      from: [r.apiKey.actorId, r.apiKey.organizationId],
      to: [r.actor.id, r.actor.organizationId],
      optional: false,
    }),
    // Each API key records its creating actor.
    creator: r.one.actor({
      from: [r.apiKey.createdByActorId, r.apiKey.organizationId],
      to: [r.actor.id, r.actor.organizationId],
      optional: false,
    }),
    // A revoked API key can record its revoking actor.
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
    // One organization can be active in many sessions.
    activeSessions: r.many.session({
      from: r.organization.id,
      to: r.session.activeOrganizationId,
    }),
    // One organization can define many roles.
    organizationRoles: r.many.organizationRole({
      from: r.organization.id,
      to: r.organizationRole.organizationId,
    }),
    // One organization can have many members.
    organizationMembers: r.many.organizationMember({
      from: r.organization.id,
      to: r.organizationMember.organizationId,
    }),
    // One organization can have many actors.
    actors: r.many.actor({ from: r.organization.id, to: r.actor.organizationId }),
    // One organization can have many API keys.
    apiKeys: r.many.apiKey({ from: r.organization.id, to: r.apiKey.organizationId }),
    // One organization can have many invitations.
    invitations: r.many.invitation({
      from: r.organization.id,
      to: r.invitation.organizationId,
    }),
    // One organization can own many wallet keys.
    walletKeys: r.many.walletKey({
      from: r.organization.id,
      to: r.walletKey.organizationId,
    }),
    // One organization can own many signing keys.
    signingKeys: r.many.signingKey({
      from: r.organization.id,
      to: r.signingKey.organizationId,
    }),
    // One organization can own many wallets.
    wallets: r.many.wallet({ from: r.organization.id, to: r.wallet.organizationId }),
    // One organization can own many session keys.
    sessionKeys: r.many.sessionKey({
      from: r.organization.id,
      to: r.sessionKey.organizationId,
    }),
    // One organization can own many session-key grants.
    sessionKeyGrants: r.many.sessionKeyGrant({
      from: r.organization.id,
      to: r.sessionKeyGrant.organizationId,
    }),
    // One organization can own many policy states.
    sessionKeyPolicyStates: r.many.sessionKeyPolicyState({
      from: r.organization.id,
      to: r.sessionKeyPolicyState.organizationId,
    }),
    // One organization can own many policy reservations.
    sessionKeyPolicyReservations: r.many.sessionKeyPolicyReservation({
      from: r.organization.id,
      to: r.sessionKeyPolicyReservation.organizationId,
    }),
    // One organization can have many confirmed executions.
    executions: r.many.execution({
      from: r.organization.id,
      to: r.execution.organizationId,
    }),
    // One organization can have many execution submissions.
    executionSubmissions: r.many.executionSubmission({
      from: r.organization.id,
      to: r.executionSubmission.organizationId,
    }),
    // One organization can have many audit events.
    auditEvents: r.many.organizationEvent({
      from: r.organization.id,
      to: r.organizationEvent.organizationId,
    }),
    // One organization can have many notifications.
    notifications: r.many.notification({
      from: r.organization.id,
      to: r.notification.organizationId,
    }),
    // One organization can have many notification preferences.
    notificationPreferences: r.many.notificationPreference({
      from: r.organization.id,
      to: r.notificationPreference.organizationId,
    }),
    // Each organization can have one billing account.
    billingAccount: r.one.billingAccount({
      from: r.organization.id,
      to: r.billingAccount.organizationId,
    }),
    // One organization can retain many billing subscriptions.
    billingSubscriptions: r.many.billingSubscription({
      from: r.organization.id,
      to: r.billingSubscription.organizationId,
    }),
    // One organization can be selected by many OAuth requests.
    oauthAuthorizationRequests: r.many.oauthAuthorizationRequest({
      from: r.organization.id,
      to: r.oauthAuthorizationRequest.organizationId,
    }),
    // One organization can grant many OAuth authorizations.
    oauthAuthorizations: r.many.oauthAuthorization({
      from: r.organization.id,
      to: r.oauthAuthorization.organizationId,
    }),
    // One organization can approve many CLI device authorizations.
    oauthDeviceAuthorizations: r.many.oauthDeviceAuthorization({
      from: r.organization.id,
      to: r.oauthDeviceAuthorization.organizationId,
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
    // A system organization role maps to one predefined role template.
    systemRole: r.one.systemRole({
      from: r.organizationRole.systemRoleId,
      to: r.systemRole.id,
    }),
    // One organization role can be assigned to many members.
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
    // Each organization member owns one user actor.
    actor: r.one.actor({
      from: r.organizationMember.actorId,
      to: r.actor.id,
      optional: false,
    }),
    // Each organization member references one user.
    user: r.one.user({
      from: r.organizationMember.userId,
      to: r.user.id,
      optional: false,
    }),
    // Each organization member belongs to one organization.
    organization: r.one.organization({
      from: r.organizationMember.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each organization member has one assigned role.
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
    // Each invitation grants one organization role.
    organizationRole: r.one.organizationRole({
      from: r.invitation.organizationRoleId,
      to: r.organizationRole.id,
      optional: false,
    }),
    // Each invitation records one inviting user.
    inviter: r.one.user({
      from: r.invitation.inviterId,
      to: r.user.id,
      optional: false,
    }),
  },
}));
