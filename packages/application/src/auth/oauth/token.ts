import { DateTime, Duration, Effect, Metric, Schema } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import { OAuthTokenError, OAuthTokenFamilyId } from "@namera-ai/protocol";
import type { OAuthScope, OAuthToken } from "@namera-ai/protocol/model";
import { oauthTokenDuration, oauthTokenResults } from "@namera-ai/telemetry";
import { generateUniqueId } from "@namera-ai/utils";

import { AuthConfig } from "#/auth/config";

export interface OAuthTokenResult {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresIn: number;
  readonly scopes: ReadonlyArray<OAuthScope>;
}

export const makeOAuthTokenApplication = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const crypto = yield* CryptoService;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;

  const issue = Effect.fnUntraced(function* (input: {
    readonly authorizationId: OAuthToken["authorizationId"];
    readonly clientId: OAuthToken["clientId"];
    readonly resource: string;
    readonly scopes: ReadonlyArray<OAuthScope>;
    readonly now: DateTime.Utc;
    readonly refreshFamilyId?: OAuthTokenFamilyId;
    readonly refreshParentId?: OAuthToken["id"];
  }) {
    const accessToken = yield* crypto.randomToken(config.oauth.tokenBytes);
    const accessTokenHash = yield* crypto.hash({
      purpose: cryptoPurpose.oauthAccessToken,
      value: accessToken,
    });
    const refreshToken = input.scopes.includes("offline_access")
      ? yield* crypto.randomToken(config.oauth.tokenBytes)
      : undefined;
    const refreshTokenHash =
      refreshToken === undefined
        ? undefined
        : yield* crypto.hash({
            purpose: cryptoPurpose.oauthRefreshToken,
            value: refreshToken,
          });
    yield* repository.auth.oauth.token.insertAccess({
      authorizationId: input.authorizationId,
      clientId: input.clientId,
      type: "access",
      tokenHash: accessTokenHash,
      familyId: null,
      parentId: null,
      resource: input.resource,
      scopes: input.scopes,
      expiresAt: DateTime.addDuration(input.now, config.oauth.accessTokenTimeToLive),
    });
    if (refreshTokenHash !== undefined) {
      yield* repository.auth.oauth.token.insertRefresh({
        authorizationId: input.authorizationId,
        clientId: input.clientId,
        type: "refresh",
        tokenHash: refreshTokenHash,
        familyId:
          input.refreshFamilyId ?? Schema.decodeSync(OAuthTokenFamilyId)(generateUniqueId()),
        parentId: input.refreshParentId ?? null,
        resource: input.resource,
        scopes: input.scopes,
        expiresAt: DateTime.addDuration(input.now, config.oauth.refreshTokenTimeToLive),
      });
    }
    return {
      accessToken,
      ...(refreshToken === undefined ? {} : { refreshToken }),
      expiresIn: Math.floor(Duration.toSeconds(config.oauth.accessTokenTimeToLive)),
      scopes: input.scopes,
    } satisfies OAuthTokenResult;
  });

  const exchangeAuthorizationCode = Effect.fn("application.oauth.token.exchange_code")(
    function* (input: {
      readonly code: string;
      readonly clientId: string;
      readonly redirectUri: string;
      readonly codeVerifier: string;
      readonly resource: string;
    }) {
      const client = yield* repository.auth.oauth.client.findByClientId(input.clientId);
      if (
        client === undefined ||
        client.status !== "active" ||
        !client.grantTypes.includes("authorization_code")
      ) {
        return yield* new OAuthTokenError({ code: "INVALID_CLIENT" });
      }
      const now = yield* DateTime.now;
      const codeHash = yield* crypto.hash({
        purpose: cryptoPurpose.oauthAuthorizationCode,
        value: input.code,
      });
      const codeChallenge = yield* crypto.sha256(input.codeVerifier);
      const result = yield* transaction.run(
        Effect.gen(function* () {
          const code = yield* repository.auth.oauth.authorizationCode.consumeByHash(codeHash, now);
          if (
            code === undefined ||
            code.clientId !== client.id ||
            code.redirectUri !== input.redirectUri ||
            code.resource !== input.resource ||
            code.codeChallenge !== codeChallenge
          ) {
            return yield* new OAuthTokenError({ code: "INVALID_GRANT" });
          }
          const authorization = yield* repository.auth.oauth.authorization.findActiveById(
            code.authorizationId,
            now,
          );
          if (authorization === undefined || authorization.clientId !== client.id) {
            return yield* new OAuthTokenError({ code: "INVALID_GRANT" });
          }
          return yield* issue({
            authorizationId: authorization.id,
            clientId: client.id,
            resource: code.resource,
            scopes: code.scopes,
            now,
          });
        }),
      );
      yield* Metric.update(Metric.withAttributes(oauthTokenResults, { result: "issued" }), 1);
      return result;
    },
    Effect.trackDuration(oauthTokenDuration),
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const refresh = Effect.fn("application.oauth.token.refresh")(
    function* (input: {
      readonly refreshToken: string;
      readonly clientId: string;
      readonly scopes?: ReadonlyArray<string>;
    }) {
      const client = yield* repository.auth.oauth.client.findByClientId(input.clientId);
      if (
        client === undefined ||
        client.status !== "active" ||
        !client.grantTypes.includes("refresh_token")
      ) {
        return yield* new OAuthTokenError({ code: "INVALID_CLIENT" });
      }
      const now = yield* DateTime.now;
      const tokenHash = yield* crypto.hash({
        purpose: cryptoPurpose.oauthRefreshToken,
        value: input.refreshToken,
      });
      const existing = yield* repository.auth.oauth.token.findByHash(tokenHash);
      if (
        existing === undefined ||
        existing.type !== "refresh" ||
        existing.clientId !== client.id
      ) {
        return yield* new OAuthTokenError({ code: "INVALID_GRANT" });
      }
      if (existing.consumedAt !== null || existing.revokedAt !== null) {
        yield* repository.auth.oauth.token.revokeAuthorization(existing.authorizationId, now);
        yield* Metric.update(Metric.withAttributes(oauthTokenResults, { result: "reuse" }), 1);
        return yield* new OAuthTokenError({ code: "INVALID_GRANT" });
      }
      const requestedScopes = input.scopes ?? existing.scopes;
      if (requestedScopes.some((scope) => !existing.scopes.includes(scope as OAuthScope))) {
        return yield* new OAuthTokenError({ code: "INVALID_SCOPE" });
      }
      const scopes = requestedScopes as ReadonlyArray<OAuthScope>;
      const result = yield* transaction.run(
        Effect.gen(function* () {
          const consumed = yield* repository.auth.oauth.token.consumeRefreshByHash(tokenHash, now);
          if (consumed === undefined || consumed.type !== "refresh") {
            return yield* new OAuthTokenError({ code: "INVALID_GRANT" });
          }
          const authorization = yield* repository.auth.oauth.authorization.findActiveById(
            consumed.authorizationId,
            now,
          );
          if (authorization === undefined) {
            return yield* new OAuthTokenError({ code: "INVALID_GRANT" });
          }
          return yield* issue({
            authorizationId: authorization.id,
            clientId: client.id,
            resource: consumed.resource,
            scopes,
            now,
            refreshFamilyId: consumed.familyId,
            refreshParentId: consumed.id,
          });
        }),
      );
      yield* Metric.update(Metric.withAttributes(oauthTokenResults, { result: "refreshed" }), 1);
      return result;
    },
    Effect.trackDuration(oauthTokenDuration),
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const revokeToken = Effect.fn("application.oauth.token.revoke")(
    function* (token: string) {
      const now = yield* DateTime.now;
      const [accessHash, refreshHash] = yield* Effect.all([
        crypto.hash({ purpose: cryptoPurpose.oauthAccessToken, value: token }),
        crypto.hash({ purpose: cryptoPurpose.oauthRefreshToken, value: token }),
      ]);
      const access = yield* repository.auth.oauth.token.revokeByHash(accessHash, now);
      if (access === undefined) yield* repository.auth.oauth.token.revokeByHash(refreshHash, now);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { exchangeAuthorizationCode, refresh, revokeToken };
});
