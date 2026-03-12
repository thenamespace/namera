import {
  Data,
  Effect,
  FileSystem,
  Layer,
  Path,
  Schema,
  ServiceMap,
} from "effect";

import { ConfigManager } from "./config";

export type AliasType = "account" | "session" | "keystore";

export class AliasError extends Data.TaggedError("AliasError")<{
  code: "AlreadyExists" | "NotFound";
}> {}

export type AliasManagerShape = {
  getAlias: (params: {
    type: AliasType;
    identifier: string;
  }) => Effect.Effect<string | undefined>;
  getIdentifier: (params: {
    type: AliasType;
    alias: string;
  }) => Effect.Effect<string | undefined>;
  setAlias: (params: {
    type: AliasType;
    identifier: string;
    alias: string;
  }) => Effect.Effect<void, AliasError>;
  ensureUniqueAlias: (params: {
    type: AliasType;
    alias: string;
  }) => Effect.Effect<void, AliasError>;
  getAliasFile: (type: AliasType) => Effect.Effect<{
    aliasToId: Map<string, string>;
    content: Record<string, string>;
    idToAlias: Map<string, string>;
    path: string;
  }>;
};
// Alias => Identifier
const AliasFile = Schema.Record(
  Schema.mutableKey(Schema.String),
  Schema.String,
);

export const AliasManager =
  ServiceMap.Service<AliasManagerShape>("AliasManager");

export const AliasManagerLive = Layer.effect(
  AliasManager,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const configManager = yield* ConfigManager;

    const getAliasFile = (type: AliasType) =>
      Effect.gen(function* () {
        const configPath = yield* configManager.getConfigPath();
        const aliasFile = path.join(configPath, "aliases", `${type}s.json`);
        const content = yield* fs
          .readFileString(aliasFile)
          .pipe(Effect.orElseSucceed(() => "{}"));

        const parsedContent = Schema.decodeUnknownSync(AliasFile)(
          JSON.parse(content),
        );

        const idToAlias = new Map<string, string>();
        const aliasToId = new Map<string, string>();

        for (const [alias, id] of Object.entries(parsedContent)) {
          idToAlias.set(id, alias);
          aliasToId.set(alias, id);
        }

        return {
          aliasToId,
          content: parsedContent,
          idToAlias,
          path: aliasFile,
        };
      });

    return AliasManager.of({
      ensureUniqueAlias: (params) =>
        Effect.gen(function* () {
          const { aliasToId } = yield* getAliasFile(params.type);
          const exists = aliasToId.has(params.alias);

          if (exists) {
            return yield* Effect.fail(
              new AliasError({ code: "AlreadyExists" }),
            );
          }
        }),
      getAlias: (params) =>
        Effect.gen(function* () {
          const { idToAlias } = yield* getAliasFile(params.type);
          return idToAlias.get(params.identifier);
        }),
      getAliasFile: (type) => getAliasFile(type),
      getIdentifier: (params) =>
        Effect.gen(function* () {
          const { aliasToId } = yield* getAliasFile(params.type);
          return aliasToId.get(params.alias);
        }),
      setAlias: (params) =>
        Effect.gen(function* () {
          const { aliasToId, path } = yield* getAliasFile(params.type);

          const exists = aliasToId.has(params.alias);

          if (exists) {
            return yield* Effect.fail(
              new AliasError({ code: "AlreadyExists" }),
            );
          }

          aliasToId.set(params.alias, params.identifier);
          const data = Object.fromEntries(aliasToId.entries());

          yield* fs
            .writeFileString(path, JSON.stringify(data))
            .pipe(Effect.orDie);
        }),
    });
  }),
);
