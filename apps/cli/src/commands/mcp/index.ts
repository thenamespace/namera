import {
  Effect,
  Layer,
  Option,
  Redacted,
  Schema,
  Stdio,
  Stream,
  Deferred,
  Logger,
  Fiber,
} from "effect";
import { Command, Flag } from "effect/cli";

import { NAMERA_API_ORIGIN } from "@namera-ai/sdk";

import { cliFailure, errorFeedback } from "#/services/error-feedback";
import { makeMcpApiClient, McpAuthentication } from "#/services/mcp/api-client";
import { mcpCredentialStore, McpProfile } from "#/services/mcp/credential-store";
import { createMcpSession } from "#/services/mcp/session";
import { mcpStdio } from "#/services/mcp/stdio";
import { localToolError } from "#/services/mcp/tool-errors";
import { LocalMcpApiOrigin } from "#/services/mcp/transport-security";
import { printValue } from "#/services/output";
import { recordView } from "#/services/output/document";
import { resolveCliSessionSigner } from "#/services/session-keystore/index";

const flags = {
  profile: Flag.String("profile").pipe(Flag.withDefault("default")),
  host: Flag.String("host").pipe(
    Flag.withDefault(NAMERA_API_ORIGIN),
    Flag.withDescription("Namera API origin"),
  ),
};
const session = Effect.fn("Mcp.session")(function* (options: { host: string; profile: string }) {
  const apiOrigin = new URL(yield* Schema.decodeUnknownEffect(LocalMcpApiOrigin)(options.host))
    .origin;
  const profile = yield* Schema.decodeUnknownEffect(McpProfile)(options.profile);
  return yield* Effect.acquireRelease(
    Effect.try(() =>
      createMcpSession({ apiOrigin, profile, store: mcpCredentialStore(apiOrigin, profile) }),
    ),
    (value) => Effect.sync(() => value.close()),
  );
});

const serve = Command.make(
  "serve",
  {
    ...flags,
    maxGasCost: Flag.String("max-gas-cost-wei").pipe(
      Flag.optional,
      Flag.withDescription("Fee ceiling for self-funded operations; default is sponsored only"),
    ),
  },
  Effect.fn("Mcp.serve")(
    function* (options) {
      const connection = yield* session(options);
      const apiOrigin = new URL(options.host).origin;
      const maxGasCostWei = Option.isSome(options.maxGasCost)
        ? yield* Schema.decodeUnknownEffect(
            Schema.BigIntFromString.check(Schema.isGreaterThanOrEqualToBigInt(0n)),
          )(options.maxGasCost.value)
        : undefined;
      const principal = Effect.gen(function* () {
        const credentials = yield* Effect.tryPromise({
          try: connection.credentials,
          catch: () => localToolError("UNAUTHORIZED"),
        });
        if (!credentials) {
          connection.requestLogin();
          return yield* Effect.fail({
            ...localToolError("UNAUTHORIZED"),
            message: `Authorize Namera in your browser, or run namera mcp login --profile ${options.profile} --host ${apiOrigin}. Then retry.`,
          });
        }
        return yield* makeMcpApiClient(
          { apiOrigin, resolveSessionSigner: resolveCliSessionSigner(apiOrigin, maxGasCostWei) },
          {
            accessToken: Redacted.make(credentials.accessToken),
            clientId: credentials.clientId,
            scopes: credentials.scopes,
          },
        ).pipe(
          Effect.mapError((error) =>
            localToolError(
              error.code === "temporarily_unavailable" ? "UPSTREAM_UNAVAILABLE" : "UNAUTHORIZED",
            ),
          ),
        );
      });
      const io = yield* Stdio.Stdio;
      const ended = yield* Deferred.make<void>();
      const transport = Stdio.make({
        ...io,
        stdin: io.stdin.pipe(Stream.ensuring(Deferred.succeed(ended, undefined))),
      });
      // The stdio protocol interrupts its construction fiber on EOF. Isolate
      // that fiber so the command can finish normally after stdin closes.
      yield* Layer.build(
        mcpStdio.pipe(
          Layer.provide(Layer.succeed(McpAuthentication, { principal })),
          Layer.provide(Layer.succeed(Stdio.Stdio, transport)),
        ),
      ).pipe(Effect.forkScoped, Effect.flatMap(Fiber.join));
      yield* Deferred.await(ended);
    },
    Effect.scoped,
    Effect.provide(Logger.layer([Logger.withConsoleError(Logger.formatSimple)])),
  ),
);

const login = Command.make(
  "login",
  flags,
  Effect.fn("Mcp.login")(function* (options) {
    const connection = yield* session(options);
    yield* Effect.tryPromise({
      try: connection.login,
      catch: (error) => {
        const feedback = errorFeedback(error);
        return feedback.code === "INTERNAL_ERROR" ? cliFailure("MCP_LOGIN_FAILED") : feedback;
      },
    });
    yield* printValue(connection.status(), recordView("MCP connection"));
  }, Effect.scoped),
);
const status = Command.make(
  "status",
  flags,
  Effect.fn("Mcp.status")(function* (options) {
    const connection = yield* session(options);
    yield* printValue(yield* Effect.try(connection.status), recordView("MCP connection"));
  }, Effect.scoped),
);
const logout = Command.make(
  "logout",
  flags,
  Effect.fn("Mcp.logout")(function* (options) {
    const connection = yield* session(options);
    yield* Effect.tryPromise({
      try: connection.logout,
      catch: () => cliFailure("MCP_LOGOUT_FAILED"),
    });
    yield* printValue(
      { profile: options.profile, status: "signed-out" },
      recordView("MCP signed out"),
    );
  }, Effect.scoped),
);

export const mcpCommand = Command.make("mcp").pipe(
  Command.withDescription("Local stdio MCP with persistent OAuth authorization"),
  Command.withSubcommands([serve, login, status, logout]),
);
