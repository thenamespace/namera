import { Effect, FileSystem, Path, Schema } from "effect";

import type { AliasType } from "@/types";

// Identifier => Alias
export const AliasFile = Schema.Record(
  Schema.mutableKey(Schema.String),
  Schema.String,
);

export const getAliasFile = (type: AliasType, configPath: string) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;

    const aliasFile = path.join(configPath, "aliases", `${type}s.json`);
    const content = yield* fs
      .readFileString(aliasFile)
      .pipe(Effect.orElseSucceed(() => "{}"));

    const parsedContent = Schema.decodeUnknownSync(AliasFile)(
      JSON.parse(content),
    );

    const idToAlias = new Map<string, string>();
    const aliasToId = new Map<string, string>();

    for (const [id, alias] of Object.entries(parsedContent)) {
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
