import { DateTime, Effect, Redacted, Schema } from "effect";

import type { OneClawCustomerAuthority } from "@namera-ai/protocol/model";

import type { ClientContext } from "#/client";
import { oneClawError } from "#/errors";
import { IdentityResponse, RedeemResponse } from "#/responses";

export interface Claim {
  readonly connectionId: string;
  readonly token: Redacted.Redacted<string>;
  readonly expiresAt: DateTime.Utc;
}

export const makeCustomers = ({
  request,
  anonymous,
  client,
  customer,
  platform,
}: ClientContext) => ({
  redeemClaim: Effect.fn("wallet-providers.oneclaw.customers.redeemClaim")(function* (input: {
    readonly claim: Claim;
    readonly expectedCustomerId: string;
  }) {
    const operation = "customers.redeemClaim";
    const startedAt = yield* DateTime.now;
    if (DateTime.toEpochMillis(input.claim.expiresAt) <= DateTime.toEpochMillis(startedAt)) {
      return yield* oneClawError(operation, "AUTHORITY_EXPIRED");
    }
    const response = yield* request(operation, RedeemResponse, () =>
      anonymous.platform.claimRedeem(Redacted.value(input.claim.token)),
    );
    if (response.connection_id !== input.claim.connectionId)
      return yield* oneClawError(operation, "IDENTITY_MISMATCH");
    const authenticated = client(response.auth_token);
    const identity = yield* request(operation, IdentityResponse, () =>
      authenticated.http.request("GET", "/v1/auth/me"),
    );
    if (identity.id !== input.expectedCustomerId)
      return yield* oneClawError(operation, "IDENTITY_MISMATCH");
    return {
      connectionId: response.connection_id,
      customerId: identity.id,
      token: response.auth_token,
      expiresAt: DateTime.add(startedAt, { seconds: response.expires_in }),
    };
  }),
  getIdentity: Effect.fn("wallet-providers.oneclaw.customers.getIdentity")(function* (
    authority: OneClawCustomerAuthority,
  ) {
    yield* customer("customers.getIdentity", authority);
    return { customerId: authority.payload.customerId };
  }),
  enableDelegation: Effect.fn("wallet-providers.oneclaw.customers.enableDelegation")(function* (
    authority: OneClawCustomerAuthority,
  ) {
    const operation = "customers.enableDelegation";
    const authenticated = yield* customer(operation, authority);
    yield* request(operation, Schema.Unknown, () =>
      authenticated.platform.updateConnectionDelegation(authority.payload.externalConnectionId, {
        delegation_enabled: true,
        delegation_scopes: ["agents:read", "agents:write"],
      }),
    );
    // Verify delegated read access; the write scope is verified by the later create.
    // No agent is created as a readiness probe.
    yield* request(operation, Schema.Struct({ agents: Schema.Array(Schema.Unknown) }), () =>
      platform.platform.withConnection(authority.payload.externalConnectionId).agents.list(),
    );
  }),
});
