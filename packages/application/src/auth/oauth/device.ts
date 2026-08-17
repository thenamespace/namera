import { DateTime, Duration, Effect, Metric } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import {
  OAuthDeviceAuthorizationError,
  OAuthTokenError,
  type ActorId,
  type OAuthDeviceAuthorizationId,
  type OrganizationId,
  type SessionKeyId,
  type UserId,
} from "@namera-ai/protocol";
import type { OAuthScope } from "@namera-ai/protocol/model";
import {
  cliAuthorizations,
  oauthDeviceAuthorizationDecisions,
  oauthDeviceAuthorizationRequests,
  oauthDeviceTokenPolls,
} from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";
import { makeCreateNotification } from "#/notification/create";

import type { OAuthTokenApplication } from "./token.js";

const cliScopes = new Set<OAuthScope>([
  "wallet:read",
  "session-key:read",
  "execution:read",
  "execution:execute",
  "signature:create",
  "offline_access",
]);

const normalizeUserCode = (value: string) => value.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");

const formatUserCode = (value: string) => `${value.slice(0, 4)}-${value.slice(4)}`;

export const makeOAuthDeviceApplication = (token: OAuthTokenApplication) =>
  Effect.gen(function* () {
    const audit = yield* Audit;
    const config = yield* AuthConfig;
    const crypto = yield* CryptoService;
    const createNotification = yield* makeCreateNotification;
    const repository = yield* Repository;
    const transaction = yield* TransactionService;

    const ensureCliClient = Effect.fnUntraced(
      function* () {
        const existing = yield* repository.auth.oauth.client.findByClientId(
          config.oauth.cliClientId,
        );
        if (existing !== undefined) return existing;

        yield* repository.auth.oauth.client.insertPreRegistered({
          clientId: config.oauth.cliClientId,
          clientName: "Namera CLI",
          clientUri: config.dashboardPublicOrigin.toString(),
          logoUri: null,
          redirectUris: [],
          grantTypes: ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"],
          responseTypes: ["code"],
          tokenEndpointAuthMethod: "none",
          metadata: { version: 1, type: "cli" },
          status: "active",
          metadataExpiresAt: null,
        });

        const created = yield* repository.auth.oauth.client.findByClientId(
          config.oauth.cliClientId,
        );
        if (created === undefined) return yield* Effect.die("Pre-registered CLI client is missing");
        return created;
      },
      Effect.catchTag("DatabaseError", Effect.die),
    );

    const start = Effect.fn("application.oauth.device.start")(
      function* (input: {
        readonly clientId: string;
        readonly scopes: ReadonlyArray<string>;
        readonly resource: string;
        readonly deviceName: string;
        readonly cliVersion: string;
        readonly platform: string;
      }) {
        const client = yield* ensureCliClient();
        if (input.clientId !== client.clientId || client.status !== "active") {
          yield* Metric.update(
            Metric.withAttributes(oauthDeviceAuthorizationRequests, { result: "invalid_client" }),
            1,
          );
          return yield* new OAuthDeviceAuthorizationError({ code: "INVALID_CLIENT" });
        }

        const expectedResource = new URL(config.apiPublicOrigin).origin;
        if (input.resource !== expectedResource) {
          return yield* new OAuthDeviceAuthorizationError({ code: "INVALID_RESOURCE" });
        }

        const requestedScopes = [...new Set(input.scopes)];
        if (
          requestedScopes.length === 0 ||
          requestedScopes.some((scope) => !cliScopes.has(scope as OAuthScope))
        ) {
          return yield* new OAuthDeviceAuthorizationError({ code: "INVALID_SCOPE" });
        }
        const scopes = requestedScopes as ReadonlyArray<OAuthScope>;

        const now = yield* DateTime.now;
        const deviceCode = yield* crypto.randomToken(config.oauth.tokenBytes);
        const rawUserCode = yield* crypto.randomString(
          config.oauth.userCodeAlphabet,
          config.oauth.userCodeLength,
        );
        const userCode = formatUserCode(rawUserCode);
        const [deviceCodeHash, userCodeHmac] = yield* Effect.all([
          crypto.hash({ purpose: cryptoPurpose.oauthDeviceCode, value: deviceCode }),
          crypto.hmac({ purpose: cryptoPurpose.oauthUserCode, value: rawUserCode }),
        ]);

        yield* repository.auth.oauth.deviceAuthorization.insert({
          clientId: client.id,
          deviceCodeHash,
          userCodeHmac,
          requestedScopes: scopes,
          resource: expectedResource,
          status: "pending",
          pollingIntervalSeconds: config.oauth.devicePollingIntervalSeconds,
          expiresAt: DateTime.addDuration(now, config.oauth.deviceAuthorizationTimeToLive),
          metadata: {
            version: 1,
            deviceName: input.deviceName,
            cliVersion: input.cliVersion,
            platform: input.platform,
          },
        });

        const verificationUri = new URL("/cli/authorize", config.dashboardPublicOrigin);
        const verificationUriComplete = new URL(verificationUri);
        verificationUriComplete.searchParams.set("user_code", userCode);

        yield* Metric.update(
          Metric.withAttributes(oauthDeviceAuthorizationRequests, { result: "success" }),
          1,
        );

        return {
          deviceCode,
          userCode,
          verificationUri: verificationUri.toString(),
          verificationUriComplete: verificationUriComplete.toString(),
          expiresIn: Math.floor(Duration.toSeconds(config.oauth.deviceAuthorizationTimeToLive)),
          interval: config.oauth.devicePollingIntervalSeconds,
        };
      },
      Effect.catchTag("DatabaseError", Effect.die),
    );

    const get = Effect.fn("application.oauth.device.get")(
      function* (input: { readonly userCode: string; readonly userId: UserId }) {
        const normalizedCode = normalizeUserCode(input.userCode);
        if (normalizedCode.length !== config.oauth.userCodeLength) {
          return yield* new OAuthDeviceAuthorizationError({ code: "REQUEST_NOT_FOUND" });
        }

        const now = yield* DateTime.now;
        const userCodeHmac = yield* crypto.hmac({
          purpose: cryptoPurpose.oauthUserCode,
          value: normalizedCode,
        });
        const pending = yield* repository.auth.oauth.deviceAuthorization.findPendingByUserCodeHmac(
          userCodeHmac,
          now,
        );
        if (pending === undefined) {
          return yield* new OAuthDeviceAuthorizationError({ code: "REQUEST_NOT_FOUND" });
        }

        const claimed = yield* repository.auth.oauth.deviceAuthorization.claim({
          id: pending.id,
          userId: input.userId,
          now,
        });
        if (claimed === undefined) {
          return yield* new OAuthDeviceAuthorizationError({ code: "REQUEST_ALREADY_CLAIMED" });
        }

        const client = yield* repository.auth.oauth.client.findById(claimed.clientId);
        if (client === undefined)
          return yield* Effect.die("OAuth device client relation is missing");

        return { authorization: claimed, client, userCode: formatUserCode(normalizedCode) };
      },
      Effect.catchTag("DatabaseError", Effect.die),
    );

    const approve = Effect.fn("application.oauth.device.approve")(
      function* (input: {
        readonly deviceAuthorizationId: OAuthDeviceAuthorizationId;
        readonly organizationId: OrganizationId;
        readonly userId: UserId;
        readonly actorId: ActorId;
        readonly sessionKeyIds: ReadonlyArray<SessionKeyId>;
      }) {
        const now = yield* DateTime.now;
        const pending = yield* repository.auth.oauth.deviceAuthorization.findById(
          input.deviceAuthorizationId,
        );
        if (
          pending === undefined ||
          pending.status !== "pending" ||
          pending.claimedByUserId !== input.userId ||
          DateTime.toEpochMillis(pending.expiresAt) <= DateTime.toEpochMillis(now)
        ) {
          return yield* new OAuthDeviceAuthorizationError({ code: "REQUEST_NOT_FOUND" });
        }

        const sessionKeyIds = [...new Set(input.sessionKeyIds)];
        const sessionKeys = yield* Effect.forEach(sessionKeyIds, (sessionKeyId) =>
          repository.core.sessionKey.findById(sessionKeyId, input.organizationId),
        );
        if (sessionKeys.some((sessionKey) => sessionKey === undefined)) {
          return yield* new OAuthDeviceAuthorizationError({ code: "SESSION_KEY_NOT_FOUND" });
        }
        if (sessionKeys.some((sessionKey) => sessionKey?.status !== "active")) {
          return yield* new OAuthDeviceAuthorizationError({ code: "SESSION_KEY_NOT_ACTIVE" });
        }

        const client = yield* repository.auth.oauth.client.findById(pending.clientId);
        if (client === undefined)
          return yield* Effect.die("OAuth device client relation is missing");

        const authorization = yield* transaction.run(
          Effect.gen(function* () {
            const actor = yield* repository.auth.actor.insert({
              organizationId: input.organizationId,
              type: "cli",
            });
            const created = yield* repository.auth.oauth.authorization.insert({
              organizationId: input.organizationId,
              actorId: actor.id,
              clientId: client.id,
              type: "cli",
              authorizedByActorId: input.actorId,
              scopes: pending.requestedScopes,
              resource: pending.resource,
              status: "active",
              expiresAt: null,
              metadata: { type: "cli", ...pending.metadata },
            });
            yield* repository.core.sessionKeyGrant.insertMany(
              sessionKeyIds.map((sessionKeyId) => ({
                organizationId: input.organizationId,
                actorId: actor.id,
                sessionKeyId,
                grantedByActorId: input.actorId,
              })),
            );
            const approved = yield* repository.auth.oauth.deviceAuthorization.approve({
              id: pending.id,
              userId: input.userId,
              organizationId: input.organizationId,
              authorizationId: created.id,
              now,
            });
            if (approved === undefined) {
              return yield* new OAuthDeviceAuthorizationError({ code: "REQUEST_NOT_FOUND" });
            }
            const event = yield* audit.organization({
              organizationId: input.organizationId,
              actorId: input.actorId,
              event: "cli_authorization.approved",
              resourceType: "cli-authorization",
              resourceId: created.id,
              data: {
                version: 1,
                clientId: client.id,
                deviceName: pending.metadata.deviceName,
                sessionKeyIds,
              },
            });
            yield* createNotification({
              organizationId: input.organizationId,
              actorId: input.actorId,
              type: "cli_authorization.approved",
              resourceType: "cli-authorization",
              resourceId: created.id,
              data: {
                version: 1,
                deviceName: pending.metadata.deviceName,
                sessionKeyCount: sessionKeyIds.length,
              },
              idempotencyKey: `notification:cli_authorization.approved:${created.id}`,
              correlationId: event.correlationId,
              expiresAt: null,
              recipients: [{ userId: input.userId }],
            });
            return created;
          }),
        );

        yield* Metric.update(
          Metric.withAttributes(oauthDeviceAuthorizationDecisions, { result: "approved" }),
          1,
        );
        yield* Metric.update(Metric.withAttributes(cliAuthorizations, { result: "approved" }), 1);
        return authorization;
      },
      Effect.catchTag("DatabaseError", Effect.die),
    );

    const deny = Effect.fn("application.oauth.device.deny")(
      function* (input: {
        readonly deviceAuthorizationId: OAuthDeviceAuthorizationId;
        readonly userId: UserId;
      }) {
        const now = yield* DateTime.now;
        const denied = yield* repository.auth.oauth.deviceAuthorization.deny({
          id: input.deviceAuthorizationId,
          userId: input.userId,
          now,
        });
        if (denied === undefined) {
          return yield* new OAuthDeviceAuthorizationError({ code: "REQUEST_NOT_FOUND" });
        }
        yield* Metric.update(
          Metric.withAttributes(oauthDeviceAuthorizationDecisions, { result: "denied" }),
          1,
        );
        return denied;
      },
      Effect.catchTag("DatabaseError", Effect.die),
    );

    const exchange = Effect.fn("application.oauth.device.exchange")(
      function* (input: {
        readonly deviceCode: string;
        readonly clientId: string;
        readonly resource: string;
      }) {
        const deviceCodeHash = yield* crypto.hash({
          purpose: cryptoPurpose.oauthDeviceCode,
          value: input.deviceCode,
        });
        const request =
          yield* repository.auth.oauth.deviceAuthorization.findByDeviceCodeHash(deviceCodeHash);
        const client = yield* repository.auth.oauth.client.findByClientId(input.clientId);
        if (request === undefined || client === undefined || request.clientId !== client.id) {
          return yield* new OAuthTokenError({ code: "INVALID_GRANT" });
        }
        if (request.resource !== input.resource) {
          return yield* new OAuthTokenError({ code: "INVALID_TARGET" });
        }

        const now = yield* DateTime.now;
        if (DateTime.toEpochMillis(request.expiresAt) <= DateTime.toEpochMillis(now)) {
          yield* repository.auth.oauth.deviceAuthorization.expire(request.id, now);
          yield* Metric.update(
            Metric.withAttributes(oauthDeviceTokenPolls, { result: "expired" }),
            1,
          );
          return yield* new OAuthTokenError({ code: "EXPIRED_TOKEN" });
        }
        if (request.status === "denied") {
          return yield* new OAuthTokenError({ code: "ACCESS_DENIED" });
        }
        if (request.status === "consumed") {
          return yield* new OAuthTokenError({ code: "INVALID_GRANT" });
        }
        if (request.status === "pending") {
          const elapsed =
            request.lastPolledAt === null
              ? Number.POSITIVE_INFINITY
              : DateTime.toEpochMillis(now) - DateTime.toEpochMillis(request.lastPolledAt);
          const tooFast = elapsed < request.pollingIntervalSeconds * 1_000;
          yield* repository.auth.oauth.deviceAuthorization.recordPoll({
            id: request.id,
            now,
            pollingIntervalSeconds: tooFast
              ? request.pollingIntervalSeconds + 5
              : request.pollingIntervalSeconds,
          });
          yield* Metric.update(
            Metric.withAttributes(oauthDeviceTokenPolls, {
              result: tooFast ? "slow_down" : "pending",
            }),
            1,
          );
          return yield* new OAuthTokenError({
            code: tooFast ? "SLOW_DOWN" : "AUTHORIZATION_PENDING",
          });
        }
        if (request.authorizationId === null) {
          return yield* new OAuthTokenError({ code: "INVALID_GRANT" });
        }

        const consumed = yield* repository.auth.oauth.deviceAuthorization.consumeApproved({
          id: request.id,
          now,
        });
        if (consumed === undefined) return yield* new OAuthTokenError({ code: "INVALID_GRANT" });

        const result = yield* token.issueForAuthorization({
          authorizationId: request.authorizationId,
          clientId: client.id,
          resource: request.resource,
          scopes: request.requestedScopes,
          now,
        });
        yield* Metric.update(Metric.withAttributes(oauthDeviceTokenPolls, { result: "issued" }), 1);
        return result;
      },
      Effect.catchTag("DatabaseError", Effect.die),
    );

    return { approve, deny, exchange, get, start };
  });
