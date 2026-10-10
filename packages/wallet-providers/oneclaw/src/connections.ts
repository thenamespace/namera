import { DateTime, Effect, Option, Redacted, Schema } from "effect";

import { OneClawOrganizationSetupRequest } from "@namera-ai/protocol/model";

import type { ClientContext } from "#/client";
import { oneClawError } from "#/errors";
import {
  BootstrapResponse,
  ClaimResponse,
  ConnectedUsersResponse,
  ConnectionResponse,
  TemplateResponse,
  UpsertResponse,
} from "#/responses";

export const makeConnections = ({ config, platform, request }: ClientContext) => ({
  upsert: Effect.fn("wallet-providers.oneclaw.connections.upsert")(function* (input: {
    readonly subjectToken: Redacted.Redacted<string>;
    readonly displayName: string;
  }) {
    const response = yield* request("connections.upsert", UpsertResponse, () =>
      platform.platform.upsertUser({
        subject_token: Redacted.value(input.subjectToken),
        subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
        display_name: input.displayName,
        create_sub_org: true,
      }),
    );
    return { connectionId: response.connection_id };
  }),
  findBySubject: Effect.fn("wallet-providers.oneclaw.connections.findBySubject")(function* (
    subject: string,
  ) {
    const result = yield* request("connections.findBySubject", ConnectedUsersResponse, () =>
      platform.platform.listUsers(config.platformAppId),
    );
    const matches = result.users.filter((user) => user.external_subject === subject);
    if (matches.length > 1)
      return yield* oneClawError("connections.findBySubject", "RECOVERY_AMBIGUOUS");
    return Option.fromUndefinedOr(matches[0]).pipe(
      Option.map((match) => ({
        connectionId: match.connection_id,
        customerId: match.user_id,
        status: match.status,
      })),
    );
  }),
  get: Effect.fn("wallet-providers.oneclaw.connections.get")(function* (connectionId: string) {
    const response = yield* request("connections.get", ConnectionResponse, () =>
      platform.platform.getConnection(connectionId),
    );
    if (response.connection_id !== connectionId)
      return yield* oneClawError("connections.get", "IDENTITY_MISMATCH");
    return { connectionId, customerId: response.user_id, status: response.status };
  }),
  bootstrapEmpty: Effect.fn("wallet-providers.oneclaw.connections.bootstrapEmpty")(function* (
    input: OneClawOrganizationSetupRequest,
  ) {
    const operation = "connections.bootstrapEmpty";
    yield* Schema.decodeUnknownEffect(Schema.toType(OneClawOrganizationSetupRequest))(input).pipe(
      Effect.mapError(() => oneClawError(operation, "INVALID_REQUEST")),
    );
    const connectionId = input.connection.externalConnectionId;
    if (connectionId === null || input.connection.providerAppId !== config.platformAppId) {
      return yield* oneClawError(operation, "IDENTITY_MISMATCH");
    }
    const template = yield* request(operation, TemplateResponse, () =>
      platform.platform.getTemplate(config.platformAppId, config.emptyTemplateId),
    );
    if (
      template.id !== config.emptyTemplateId ||
      template.platform_app_id !== config.platformAppId ||
      template.version !== config.emptyTemplateVersion ||
      !template.is_active ||
      Object.keys(template.spec).length !== 0
    ) {
      return yield* oneClawError(operation, "TEMPLATE_MISMATCH");
    }
    const connection = yield* request(operation, ConnectionResponse, () =>
      platform.platform.getConnection(connectionId),
    );
    if (
      connection.connection_id !== connectionId ||
      connection.user_id !== input.connection.data.customerId
    ) {
      return yield* oneClawError(operation, "IDENTITY_MISMATCH");
    }
    const startedAt = yield* DateTime.now;
    const response = yield* request(operation, BootstrapResponse, () =>
      platform.platform.bootstrapUser(connectionId, { template_id: config.emptyTemplateId }),
    );
    if (response.connection_id !== connectionId)
      return yield* oneClawError(operation, "IDENTITY_MISMATCH");
    // Fail closed on new/unrecognized resource fields, not just agent_id.
    if (
      Object.values(response.summary).some(
        (value) => value !== null && !(Array.isArray(value) && value.length === 0),
      )
    ) {
      return yield* oneClawError(operation, "UNEXPECTED_RESOURCES");
    }
    return {
      connectionId,
      token: response.claim_token,
      expiresAt: DateTime.add(startedAt, { seconds: response.expires_in }),
    };
  }),
  reissueClaim: Effect.fn("wallet-providers.oneclaw.connections.reissueClaim")(function* (
    connectionId: string,
  ) {
    const startedAt = yield* DateTime.now;
    const response = yield* request("connections.reissueClaim", ClaimResponse, () =>
      platform.platform.reissueClaim(connectionId),
    );
    if (response.connection_id !== connectionId)
      return yield* oneClawError("connections.reissueClaim", "IDENTITY_MISMATCH");
    return {
      connectionId,
      token: response.claim_token,
      expiresAt: DateTime.add(startedAt, { seconds: response.expires_in }),
    };
  }),
});
