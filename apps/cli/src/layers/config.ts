import os from "node:os";

import { Effect, FileSystem, Layer, Path, ServiceMap } from "effect";

import type { AliasType } from "@/types";

export type ConfigManagerShape = {
  ensureConfigDirExists: () => Effect.Effect<string>;
  getConfigPath: () => Effect.Effect<string>;
  checkEntityExists: (params: {
    type: AliasType;
    identifier: string;
  }) => Effect.Effect<boolean>;
  getEntityPath: (params: {
    type: AliasType;
    identifier: string;
  }) => Effect.Effect<string>;
  getEntity: (params: {
    type: AliasType;
    identifier: string;
  }) => Effect.Effect<string>;
  addEntity: (params: {
    type: AliasType;
    identifier: string;
    data: string;
  }) => Effect.Effect<void>;
  getEntitiesForType: (params: { type: AliasType }) => Effect.Effect<string[]>;
};

export const ConfigManager =
  ServiceMap.Service<ConfigManagerShape>("ConfigManager");

export const ConfigManagerLive = Layer.effect(
  ConfigManager,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const getConfigPath = () =>
      Effect.sync(() => {
        const homeDir = os.homedir();
        const baseDir = path.join(homeDir, ".namera");
        return baseDir;
      });

    return ConfigManager.of({
      addEntity: (params) =>
        Effect.gen(function* () {
          const configPath = yield* getConfigPath();
          const entityPath = path.join(
            configPath,
            `${params.type}s`,
            params.identifier,
          );

          yield* fs.writeFileString(entityPath, params.data).pipe(Effect.orDie);
        }),
      checkEntityExists: (params) =>
        Effect.gen(function* () {
          const configPath = yield* getConfigPath();
          const entityPath = path.join(
            configPath,
            `${params.type}s`,
            params.identifier,
          );

          return yield* fs.exists(entityPath).pipe(Effect.orDie);
        }),
      ensureConfigDirExists: () =>
        Effect.gen(function* () {
          const homeDir = yield* Effect.sync(() => os.homedir());
          const baseDir = path.join(homeDir, ".namera");

          const subDirs = ["accounts", "session-keys", "keystores", "aliases"];
          const subFiles = [
            "aliases/accounts.json",
            "aliases/session-keys.json",
            "aliases/keystores.json",
          ];

          const directoriesToCreate = subDirs.map((dir) =>
            path.join(baseDir, dir),
          );
          const filesToCreate = subFiles.map((file) =>
            path.join(baseDir, file),
          );

          yield* Effect.forEach(
            directoriesToCreate,
            (dirPath) =>
              fs.makeDirectory(dirPath, { recursive: true }).pipe(Effect.orDie),
            { concurrency: "unbounded" },
          );

          yield* Effect.forEach(
            filesToCreate,
            (filePath) =>
              Effect.gen(function* () {
                const exists = yield* fs.exists(filePath).pipe(Effect.orDie);
                if (!exists) {
                  yield* fs.writeFileString(filePath, "{}").pipe(Effect.orDie);
                }
              }),
            { concurrency: "unbounded" },
          );

          return baseDir;
        }),
      getConfigPath,
      getEntitiesForType: (params) =>
        Effect.gen(function* () {
          const configPath = yield* getConfigPath();
          const entitiesPath = path.join(configPath, `${params.type}s`);
          const entities = yield* fs
            .readDirectory(entitiesPath)
            .pipe(Effect.orDie);

          return entities;
        }),
      getEntity: (params) =>
        Effect.gen(function* () {
          const configPath = yield* getConfigPath();
          const entityPath = path.join(
            configPath,
            `${params.type}s`,
            params.identifier,
          );
          const content = yield* fs
            .readFileString(entityPath)
            .pipe(Effect.orDie);
          return content;
        }),
      getEntityPath: (params) =>
        Effect.gen(function* () {
          const configPath = yield* getConfigPath();
          const entityPath = path.join(
            configPath,
            `${params.type}s`,
            params.identifier,
          );
          return entityPath;
        }),
    });
  }),
);
