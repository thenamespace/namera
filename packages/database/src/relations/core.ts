import { defineRelationsPart } from "drizzle-orm";

import * as schema from "#/schema/index";

export const coreRelations = defineRelationsPart(schema, (r) => ({
  signingKey: {
    // A delegated signing key is dedicated to one immutable session envelope.
    sessionKeys: r.many.sessionKey({
      from: [r.signingKey.id, r.signingKey.organizationId],
      to: [r.sessionKey.signingKeyId, r.sessionKey.organizationId],
    }),
    // Each signing key belongs to one organization.
    organization: r.one.organization({
      from: r.signingKey.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // One wallet-root signing key can control many namespace wallets.
    wallets: r.many.wallet({
      from: [r.signingKey.id, r.signingKey.organizationId],
      to: [r.wallet.signingKeyId, r.wallet.organizationId],
    }),
  },
  wallet: {
    // Each wallet belongs to one organization.
    organization: r.one.organization({
      from: r.wallet.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each wallet is controlled by one signing key.
    signingKey: r.one.signingKey({
      from: [r.wallet.signingKeyId, r.wallet.organizationId],
      to: [r.signingKey.id, r.signingKey.organizationId],
      optional: false,
    }),
    // Each wallet records its creating actor.
    creator: r.one.actor({
      from: [r.wallet.createdByActorId, r.wallet.organizationId],
      to: [r.actor.id, r.actor.organizationId],
      optional: false,
    }),
    // One wallet can own many session keys.
    sessionKeys: r.many.sessionKey({
      from: [r.wallet.id, r.wallet.organizationId],
      to: [r.sessionKey.walletId, r.sessionKey.organizationId],
    }),
    signatureOperations: r.many.signatureOperation({
      from: [r.wallet.id, r.wallet.organizationId],
      to: [r.signatureOperation.walletId, r.signatureOperation.organizationId],
    }),
  },
  sessionKey: {
    // Delegated signing material is separate from the wallet's owner key.
    signingKey: r.one.signingKey({
      from: [r.sessionKey.signingKeyId, r.sessionKey.organizationId],
      to: [r.signingKey.id, r.signingKey.organizationId],
      optional: false,
    }),
    // A logical session has one independently confirmed installation per chain.
    installations: r.many.sessionKeyInstallation({
      from: [r.sessionKey.id, r.sessionKey.organizationId],
      to: [r.sessionKeyInstallation.sessionKeyId, r.sessionKeyInstallation.organizationId],
    }),
    // Each session key belongs to one organization.
    organization: r.one.organization({
      from: r.sessionKey.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each session key belongs to one wallet.
    wallet: r.one.wallet({
      from: [r.sessionKey.walletId, r.sessionKey.organizationId],
      to: [r.wallet.id, r.wallet.organizationId],
      optional: false,
    }),
    // Each session key records its creating actor.
    creator: r.one.actor({
      from: [r.sessionKey.createdByActorId, r.sessionKey.organizationId],
      to: [r.actor.id, r.actor.organizationId],
      optional: false,
    }),
    // A revoked session key can record its revoking actor.
    revoker: r.one.actor({
      from: [r.sessionKey.revokedByActorId, r.sessionKey.organizationId],
      to: [r.actor.id, r.actor.organizationId],
    }),
    // One session key can be assigned through many grants.
    grants: r.many.sessionKeyGrant({
      from: [r.sessionKey.id, r.sessionKey.organizationId],
      to: [r.sessionKeyGrant.sessionKeyId, r.sessionKeyGrant.organizationId],
    }),
    // One session key can own many policy-state records.
    policyStates: r.many.sessionKeyPolicyState({
      from: [r.sessionKey.id, r.sessionKey.organizationId],
      to: [r.sessionKeyPolicyState.sessionKeyId, r.sessionKeyPolicyState.organizationId],
    }),
    // One session key can own many policy reservations.
    policyReservations: r.many.sessionKeyPolicyReservation({
      from: [r.sessionKey.id, r.sessionKey.organizationId],
      to: [
        r.sessionKeyPolicyReservation.sessionKeyId,
        r.sessionKeyPolicyReservation.organizationId,
      ],
    }),
    signatureOperations: r.many.signatureOperation({
      from: [r.sessionKey.id, r.sessionKey.organizationId],
      to: [r.signatureOperation.sessionKeyId, r.signatureOperation.organizationId],
    }),
  },
  sessionKeyInstallation: {
    // Installation and revocation can have several historical approval attempts.
    operations: r.many.sessionKeyOperation({
      from: [r.sessionKeyInstallation.id, r.sessionKeyInstallation.organizationId],
      to: [r.sessionKeyOperation.installationId, r.sessionKeyOperation.organizationId],
    }),
    // Composite ownership binds the installation to the exact wallet and tenant.
    sessionKey: r.one.sessionKey({
      from: [
        r.sessionKeyInstallation.sessionKeyId,
        r.sessionKeyInstallation.walletId,
        r.sessionKeyInstallation.organizationId,
      ],
      to: [r.sessionKey.id, r.sessionKey.walletId, r.sessionKey.organizationId],
      optional: false,
    }),
  },
  sessionKeyOperation: {
    // The approval attempt is bound to one installation on exactly one chain.
    installation: r.one.sessionKeyInstallation({
      from: [
        r.sessionKeyOperation.installationId,
        r.sessionKeyOperation.walletId,
        r.sessionKeyOperation.chainId,
        r.sessionKeyOperation.organizationId,
      ],
      to: [
        r.sessionKeyInstallation.id,
        r.sessionKeyInstallation.walletId,
        r.sessionKeyInstallation.chainId,
        r.sessionKeyInstallation.organizationId,
      ],
      optional: false,
    }),
    // Only the initiating actor may complete its browser approval.
    actor: r.one.actor({
      from: [r.sessionKeyOperation.actorId, r.sessionKeyOperation.organizationId],
      to: [r.actor.id, r.actor.organizationId],
      optional: false,
    }),
  },
  sessionKeyGrant: {
    // Each grant belongs to one organization.
    organization: r.one.organization({
      from: r.sessionKeyGrant.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each grant authorizes one actor.
    actor: r.one.actor({
      from: [r.sessionKeyGrant.actorId, r.sessionKeyGrant.organizationId],
      to: [r.actor.id, r.actor.organizationId],
      optional: false,
    }),
    // Each grant references one session key.
    sessionKey: r.one.sessionKey({
      from: [r.sessionKeyGrant.sessionKeyId, r.sessionKeyGrant.organizationId],
      to: [r.sessionKey.id, r.sessionKey.organizationId],
      optional: false,
    }),
    // Each grant records its issuing actor.
    grantedBy: r.one.actor({
      from: [r.sessionKeyGrant.grantedByActorId, r.sessionKeyGrant.organizationId],
      to: [r.actor.id, r.actor.organizationId],
      optional: false,
    }),
    // A revoked grant can record its revoking actor.
    revokedBy: r.one.actor({
      from: [r.sessionKeyGrant.revokedByActorId, r.sessionKeyGrant.organizationId],
      to: [r.actor.id, r.actor.organizationId],
    }),
    // One grant can authorize many confirmed executions.
    executions: r.many.execution({
      from: [r.sessionKeyGrant.id, r.sessionKeyGrant.organizationId],
      to: [r.execution.sessionKeyGrantId, r.execution.organizationId],
    }),
    // One grant can authorize many execution submissions.
    executionSubmissions: r.many.executionSubmission({
      from: [r.sessionKeyGrant.id, r.sessionKeyGrant.organizationId],
      to: [r.executionSubmission.sessionKeyGrantId, r.executionSubmission.organizationId],
    }),
    signatureOperations: r.many.signatureOperation({
      from: [r.sessionKeyGrant.id, r.sessionKeyGrant.organizationId],
      to: [r.signatureOperation.sessionKeyGrantId, r.signatureOperation.organizationId],
    }),
  },
  signatureOperation: {
    organization: r.one.organization({
      from: r.signatureOperation.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    actor: r.one.actor({
      from: [r.signatureOperation.actorId, r.signatureOperation.organizationId],
      to: [r.actor.id, r.actor.organizationId],
      optional: false,
    }),
    wallet: r.one.wallet({
      from: [r.signatureOperation.walletId, r.signatureOperation.organizationId],
      to: [r.wallet.id, r.wallet.organizationId],
      optional: false,
    }),
    sessionKey: r.one.sessionKey({
      from: [r.signatureOperation.sessionKeyId, r.signatureOperation.organizationId],
      to: [r.sessionKey.id, r.sessionKey.organizationId],
      optional: false,
    }),
    sessionKeyGrant: r.one.sessionKeyGrant({
      from: [r.signatureOperation.sessionKeyGrantId, r.signatureOperation.organizationId],
      to: [r.sessionKeyGrant.id, r.sessionKeyGrant.organizationId],
      optional: false,
    }),
    policyReservations: r.many.sessionKeyPolicyReservation({
      from: [r.signatureOperation.id, r.signatureOperation.organizationId],
      to: [
        r.sessionKeyPolicyReservation.signatureOperationId,
        r.sessionKeyPolicyReservation.organizationId,
      ],
    }),
  },
  executionSubmission: {
    // The installed authority and actor grant must reference the same session.
    installation: r.one.sessionKeyInstallation({
      from: [
        r.executionSubmission.installationId,
        r.executionSubmission.sessionKeyId,
        r.executionSubmission.organizationId,
      ],
      to: [
        r.sessionKeyInstallation.id,
        r.sessionKeyInstallation.sessionKeyId,
        r.sessionKeyInstallation.organizationId,
      ],
      optional: false,
    }),
    // Each execution submission belongs to one organization.
    organization: r.one.organization({
      from: r.executionSubmission.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each execution submission records its requesting actor.
    actor: r.one.actor({
      from: [r.executionSubmission.actorId, r.executionSubmission.organizationId],
      to: [r.actor.id, r.actor.organizationId],
      optional: false,
    }),
    // Each execution submission uses one session-key grant.
    sessionKeyGrant: r.one.sessionKeyGrant({
      from: [r.executionSubmission.sessionKeyGrantId, r.executionSubmission.organizationId],
      to: [r.sessionKeyGrant.id, r.sessionKeyGrant.organizationId],
      optional: false,
    }),
    // A confirmed execution submission can have one execution record.
    execution: r.one.execution({
      from: r.executionSubmission.id,
      to: r.execution.executionSubmissionId,
    }),
    // One execution submission can own many policy reservations.
    policyReservations: r.many.sessionKeyPolicyReservation({
      from: [r.executionSubmission.id, r.executionSubmission.organizationId],
      to: [
        r.sessionKeyPolicyReservation.executionSubmissionId,
        r.sessionKeyPolicyReservation.organizationId,
      ],
    }),
  },
  execution: {
    // Each confirmed execution belongs to one organization.
    organization: r.one.organization({
      from: r.execution.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each confirmed execution used one session-key grant.
    sessionKeyGrant: r.one.sessionKeyGrant({
      from: [r.execution.sessionKeyGrantId, r.execution.organizationId],
      to: [r.sessionKeyGrant.id, r.sessionKeyGrant.organizationId],
      optional: false,
    }),
    // Each confirmed execution completes one matching submission.
    executionSubmission: r.one.executionSubmission({
      from: [
        r.execution.executionSubmissionId,
        r.execution.sessionKeyGrantId,
        r.execution.organizationId,
      ],
      to: [
        r.executionSubmission.id,
        r.executionSubmission.sessionKeyGrantId,
        r.executionSubmission.organizationId,
      ],
      optional: false,
    }),
  },
  sessionKeyPolicyState: {
    // Each policy-state record belongs to one organization.
    organization: r.one.organization({
      from: r.sessionKeyPolicyState.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each policy-state record belongs to one session key.
    sessionKey: r.one.sessionKey({
      from: [r.sessionKeyPolicyState.sessionKeyId, r.sessionKeyPolicyState.organizationId],
      to: [r.sessionKey.id, r.sessionKey.organizationId],
      optional: false,
    }),
  },
  sessionKeyPolicyReservation: {
    // Each policy reservation belongs to one organization.
    organization: r.one.organization({
      from: r.sessionKeyPolicyReservation.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each policy reservation belongs to one session key.
    sessionKey: r.one.sessionKey({
      from: [
        r.sessionKeyPolicyReservation.sessionKeyId,
        r.sessionKeyPolicyReservation.organizationId,
      ],
      to: [r.sessionKey.id, r.sessionKey.organizationId],
      optional: false,
    }),
    // A policy reservation may belong to an execution submission.
    executionSubmission: r.one.executionSubmission({
      from: [
        r.sessionKeyPolicyReservation.executionSubmissionId,
        r.sessionKeyPolicyReservation.organizationId,
      ],
      to: [r.executionSubmission.id, r.executionSubmission.organizationId],
    }),
    // A policy reservation may belong to a signature operation.
    signatureOperation: r.one.signatureOperation({
      from: [
        r.sessionKeyPolicyReservation.signatureOperationId,
        r.sessionKeyPolicyReservation.organizationId,
      ],
      to: [r.signatureOperation.id, r.signatureOperation.organizationId],
    }),
  },
}));
