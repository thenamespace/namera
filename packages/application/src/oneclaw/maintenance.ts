import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import {
  ProviderConnectionError,
  type OrganizationId,
  type SigningKeyId,
} from "@namera-ai/protocol";
import { OneClawService } from "@namera-ai/wallet-provider-oneclaw";

import { makeEnsureOneClawCustomer } from "./customer.js";

/** Operator-only repair; deliberately not exposed through the public API. */
export const makeMaintainOneClawSigner = Effect.gen(function* () {
  const repository = yield* Repository;
  const ensureCustomer = yield* makeEnsureOneClawCustomer;

  return Effect.fn("application.oneclaw.maintainSigner")(function* (input: {
    readonly organizationId: OrganizationId;
    readonly signingKeyId: SigningKeyId;
    readonly apply: boolean;
  }) {
    const claw = yield* OneClawService;
    const key = yield* repository.core.signingKey.findById(
      input.signingKeyId,
      input.organizationId,
    );
    if (
      !key ||
      key.data.type !== "1claw" ||
      key.status !== "active" ||
      key.custody !== "namera-managed" ||
      !key.providerConnectionId
    )
      return yield* new ProviderConnectionError({ code: "IDENTITY_MISMATCH" });

    const authority = yield* ensureCustomer(input.organizationId, {
      existingConnectionId: key.providerConnectionId,
    });
    const customerAgent = { authority, agentId: key.data.agentId };
    const keys = yield* claw.signingKeys.list(customerAgent);
    const remote = keys[0];
    if (
      keys.length !== 1 ||
      !remote ||
      remote.id !== key.data.providerKeyId ||
      remote.version !== key.data.keyVersion ||
      remote.publicKey !== key.publicKeyHex
    )
      return yield* new ProviderConnectionError({ code: "IDENTITY_MISMATCH" });
    const agent = yield* claw.agents.get(customerAgent);
    if (
      !agent.is_active ||
      !agent.intents_api_enabled ||
      agent.raw_signing_policy === "deny" ||
      agent.raw_signing_policy === "approve"
    )
      return { status: "blocked" as const, reason: "provider_policy", signingKeyId: key.id };
    if (agent.raw_signing_enabled && agent.raw_signing_policy === "allow")
      return { status: "ready" as const, signingKeyId: key.id };
    if (!input.apply) return { status: "authorization_required" as const, signingKeyId: key.id };

    const authorized = yield* ensureCustomer(input.organizationId, {
      existingConnectionId: key.providerConnectionId,
      authorizeSigning: true,
    });
    const fresh = yield* repository.core.signingKey.findById(key.id, key.organizationId);
    if (
      !fresh ||
      fresh.status !== "active" ||
      fresh.providerConnectionId !== key.providerConnectionId ||
      fresh.credentialId !== key.credentialId ||
      fresh.publicKeyHex !== key.publicKeyHex ||
      !authorized.signingPassword
    )
      return yield* new ProviderConnectionError({ code: "CONNECTION_REVOKED" });
    const current = yield* claw.agents.get({ authority: authorized, agentId: key.data.agentId });
    if (
      !current.is_active ||
      !current.intents_api_enabled ||
      current.raw_signing_policy === "deny" ||
      current.raw_signing_policy === "approve"
    )
      return { status: "blocked" as const, reason: "provider_policy", signingKeyId: key.id };
    yield* claw.agents.setRawSigningEnabled({
      authority: authorized,
      agentId: key.data.agentId,
      enabled: true,
      password: authorized.signingPassword,
    });
    yield* Effect.logInfo("oneclaw.signer.authorization_updated", { signing_key_id: key.id });
    return { status: "ready" as const, signingKeyId: key.id };
  });
});
