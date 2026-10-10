import { Config, DateTime, Effect, Option, Schema } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import {
  CredentialId,
  Email,
  ProviderConnectionId,
  ProviderConnectionError,
  type OrganizationId,
} from "@namera-ai/protocol";
import {
  OneClawCustomerAuthority,
  OneClawCustomerCredentialPayload,
  type Credential,
  type ProviderConnection,
} from "@namera-ai/protocol/model";
import { generateUniqueId } from "@namera-ai/utils";
import { OneClawService, OneClawOidcService } from "@namera-ai/wallet-provider-oneclaw";

import { Audit } from "#/audit/layer";

const failure = () => new ProviderConnectionError({ code: "PROVISIONING_INCOMPLETE" });

export const makeEnsureOneClawCustomer = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const crypto = yield* CryptoService;
  const audit = yield* Audit;
  const decodeAuthority = Effect.fnUntraced(function* (
    connection: ProviderConnection,
    credential: Credential,
  ) {
    const cleartext = yield* crypto.decrypt({
      purpose: cryptoPurpose.providerCredential,
      value: credential.encryptedPayload,
    });
    const payload = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(OneClawCustomerCredentialPayload),
    )(cleartext).pipe(Effect.mapError(failure));
    return yield* Schema.decodeUnknownEffect(Schema.toType(OneClawCustomerAuthority))({
      connection,
      credential,
      payload,
    }).pipe(Effect.mapError(failure));
  });

  return Effect.fn("application.oneclaw.ensureCustomer")(function* (
    organizationId: OrganizationId,
  ) {
    const claw = yield* OneClawService;
    const oidc = yield* OneClawOidcService;
    const appId = yield* Config.String("ONECLAW_PLATFORM_APP_ID");
    const domain = yield* Config.String("ONECLAW_ORG_EMAIL_DOMAIN");
    const connections = repository.core.providerConnections;
    const changed = (
      connection: ProviderConnection,
      stage: "reserved" | "identity" | "bootstrap_started" | "bootstrapped" | "ready",
    ) =>
      audit.organization(
        {
          organizationId,
          actorId: null,
          event: "provider_connection.updated",
          resourceType: "provider-connection",
          resourceId: connection.id,
          data: { version: 1, provider: "1claw", stage },
        },
        { source: "system" },
      );

    let connection = yield* connections.findByOrganization(organizationId, appId);
    let newlyReserved = false;
    if (!connection) {
      connection = yield* transaction.run(
        Effect.gen(function* () {
          const reserved = yield* connections.reserve({
            id: Schema.decodeSync(ProviderConnectionId)(generateUniqueId()),
            organizationId,
            provider: "1claw",
            providerAppId: appId,
            externalConnectionId: null,
            customerCredentialId: null,
            status: "pending",
            data: {
              version: 1,
              oidcSubject: `namera:org:${organizationId}`,
              email: Schema.decodeUnknownSync(Email)(`org-${organizationId}@${domain}`),
              customerId: null,
              bootstrapCompletedAt: null,
              delegationEnabledAt: null,
            },
          });
          if (reserved) yield* changed(reserved, "reserved");
          return reserved;
        }),
      );
      newlyReserved = connection !== undefined;
      connection ??= yield* connections.findByOrganization(organizationId, appId);
    }
    if (!connection) return yield* failure();
    if (connection.status === "disabled")
      return yield* new ProviderConnectionError({ code: "CONNECTION_REVOKED" });
    const lease = { id: connection.id, organizationId, leaseToken: yield* crypto.randomToken() };
    if (!(yield* connections.acquireLease(lease))) return yield* failure();

    const setup = Effect.gen(function* () {
      let current = yield* connections.findByOrganization(organizationId, appId);
      if (!current || current.status === "disabled") return yield* failure();
      if (current.externalConnectionId === null) {
        const recovered = yield* claw.connections.findBySubject(current.data.oidcSubject);
        let remote;
        if (Option.isSome(recovered)) remote = recovered.value;
        else {
          // A prior ambiguous upsert must not create a second customer.
          if (!newlyReserved)
            return yield* new ProviderConnectionError({ code: "RECOVERY_AMBIGUOUS" });
          const organization = yield* repository.auth.organization.findById(organizationId);
          if (!organization) return yield* failure();
          const subjectToken = yield* oidc.issue({
            organizationId,
            email: current.data.email,
            displayName: organization.metadata.name,
          });
          const created = yield* claw.connections.upsert({
            subjectToken,
            displayName: organization.metadata.name,
          });
          remote = yield* claw.connections.get(created.connectionId);
        }
        const identity = remote;
        current = yield* transaction.run(
          Effect.gen(function* () {
            const updated = yield* connections.reconcileIdentity({
              ...lease,
              externalConnectionId: identity.connectionId,
              customerId: identity.customerId,
            });
            if (!updated) return yield* failure();
            yield* changed(updated, "identity");
            return updated;
          }),
        );
      }
      const externalConnectionId = current.externalConnectionId;
      const customerId = current.data.customerId;
      if (!externalConnectionId || !customerId) return yield* failure();

      if (current.data.bootstrapCompletedAt === null) {
        if (current.data.bootstrapAttemptedAt !== undefined)
          return yield* new ProviderConnectionError({ code: "RECOVERY_AMBIGUOUS" });
        const beforeBootstrap = current;
        yield* transaction.run(
          Effect.gen(function* () {
            if (!(yield* connections.startBootstrap(lease))) return yield* failure();
            yield* changed(beforeBootstrap, "bootstrap_started");
          }),
        );
        yield* claw.connections.bootstrapEmpty({ connection: current });
        current = yield* transaction.run(
          Effect.gen(function* () {
            const updated = yield* connections.recordBootstrap(lease);
            if (!updated) return yield* failure();
            yield* changed(updated, "bootstrapped");
            return updated;
          }),
        );
      }

      let credential =
        current.customerCredentialId === null
          ? undefined
          : yield* repository.core.credentials.findById(
              current.customerCredentialId,
              organizationId,
            );
      if (credential && credential.type !== "1claw-customer") return yield* failure();
      // Authenticate the existing envelope before renewing it; metadata alone is not authority.
      if (credential) yield* decodeAuthority(current, credential);
      const now = yield* DateTime.now;
      const renew =
        !credential ||
        DateTime.toEpochMillis(credential.expiresAt) <= DateTime.toEpochMillis(now) + 120_000;
      if (renew) {
        const claim = yield* claw.connections.reissueClaim(externalConnectionId);
        const redeemed = yield* claw.customers.redeemClaim({
          claim,
          expectedCustomerId: customerId,
        });
        const id = credential?.id ?? Schema.decodeSync(CredentialId)(generateUniqueId());
        const payload: OneClawCustomerCredentialPayload = {
          version: 1,
          credentialId: id,
          organizationId,
          providerConnectionId: current.id,
          providerAppId: appId,
          externalConnectionId,
          customerId,
          token: redeemed.token,
          expiresAt: redeemed.expiresAt,
        };
        const encryptedPayload = yield* crypto.encrypt({
          purpose: cryptoPurpose.providerCredential,
          value: JSON.stringify(Schema.encodeSync(OneClawCustomerCredentialPayload)(payload)),
        });
        const previous = credential;
        credential = yield* transaction.run(
          Effect.gen(function* () {
            const saved = previous
              ? yield* repository.core.credentials.replaceCustomerToken({
                  id,
                  organizationId,
                  expectedEncryptedPayload: previous.encryptedPayload,
                  encryptedPayload,
                  expiresAt: redeemed.expiresAt,
                  leaseToken: lease.leaseToken,
                })
              : yield* repository.core.credentials.insert({
                  id,
                  organizationId,
                  type: "1claw-customer",
                  data: {
                    version: 1,
                    providerConnectionId: payload.providerConnectionId,
                    providerAppId: appId,
                    externalConnectionId,
                    customerId,
                  },
                  expiresAt: redeemed.expiresAt,
                  encryptedPayload,
                });
            if (!saved) return yield* failure();
            if (
              !previous &&
              !(yield* connections.attachCustomerCredential({ ...lease, credentialId: id }))
            )
              return yield* failure();
            yield* audit.organization(
              {
                organizationId,
                actorId: null,
                event: "provider_credential.saved",
                resourceType: "credential",
                resourceId: id,
                data: { version: 1, type: "1claw-customer", renewed: previous !== undefined },
              },
              { source: "system" },
            );
            return saved;
          }),
        );
      }
      current = yield* connections.findByOrganization(organizationId, appId);
      if (!current || !credential || credential.type !== "1claw-customer") return yield* failure();
      let authority = yield* decodeAuthority(current, credential);
      yield* claw.customers.getIdentity(authority);
      if (current.status !== "ready") {
        yield* claw.customers.enableDelegation(authority);
        current = yield* transaction.run(
          Effect.gen(function* () {
            const ready = yield* connections.markReady(lease);
            if (!ready) return yield* failure();
            yield* changed(ready, "ready");
            return ready;
          }),
        );
        authority = { ...authority, connection: current };
      }
      return authority;
    });
    const heartbeat = Effect.forever(
      Effect.sleep("20 seconds").pipe(
        Effect.andThen(() => connections.renewLease(lease)),
        Effect.flatMap((renewed) => (renewed ? Effect.void : Effect.fail(failure()))),
      ),
    );
    return yield* Effect.raceFirst(setup, heartbeat).pipe(
      Effect.ensuring(connections.releaseLease(lease).pipe(Effect.orDie)),
    );
  });
});
