import os from "node:os";

import { Data, Effect, FileSystem, Layer, Path, ServiceMap } from "effect";
import type { SystemErrorTag } from "effect/PlatformError";

import { type Entity, type EntityType, entityName } from "@/types";

/**
 * Effect service for managing the CLI configuration directory and stored entities.
 */
export type ConfigManager = {
  /**
   * Ensures the base config directory and entity subdirectories exist.
   */
  ensureConfigDirExists: () => Effect.Effect<void, ConfigManagerError>;
  /**
   * Returns the absolute path to the CLI config directory.
   */
  getConfigDirPath: () => Effect.Effect<string>;
  /**
   * Resolves the absolute storage path for a given entity alias and type.
   *
   * @param entity - Entity type and alias used to build the path.
   */
  getEntityPath: <TEntityType extends EntityType>(
    entity: GetEntityParams<TEntityType>,
  ) => Effect.Effect<string>;
  /**
   * Checks if an entity exists at the expected storage path.
   *
   * @param entity - Entity type and alias to check.
   */
  checkEntityExists: <TEntityType extends EntityType>(
    entity: GetEntityParams<TEntityType>,
  ) => Effect.Effect<boolean, ConfigManagerError>;
  /**
   * Loads a single entity by alias and returns its stored content and metadata.
   *
   * @param entity - Entity type and alias to load.
   */
  getEntity: <TEntityType extends EntityType>(
    entity: GetEntityParams<TEntityType>,
  ) => Effect.Effect<Entity<TEntityType>, ConfigManagerError>;
  /**
   * Lists all entities stored for a given type.
   *
   * @param type - Entity type to enumerate.
   */
  getEntitiesForType: <TEntityType extends EntityType>(
    type: TEntityType,
  ) => Effect.Effect<Entity<TEntityType>[], ConfigManagerError>;
  /**
   * Persists a new entity to disk.
   *
   * @param entity - Entity content and metadata to store.
   */
  storeEntity: <TEntityType extends EntityType>(
    entity: Entity<TEntityType>,
  ) => Effect.Effect<Entity<TEntityType>, ConfigManagerError>;
};

/**
 * Domain error for configuration and entity storage operations.
 */
export class ConfigManagerError extends Data.TaggedError(
  "@namera-ai/cli/ConfigManagerError",
)<{
  code:
    | "InitializationError"
    | "BadArgument"
    | "EntityNotFound"
    | "EntityAlreadyExists"
    | SystemErrorTag;
  message: string;
}> {}

type GetEntityParams<TEntityType extends EntityType> = {
  type: TEntityType;
  alias: string;
};

/**
 * Service tag for resolving {@link ConfigManager} from the Effect context.
 */
export const ConfigManager = ServiceMap.Service<ConfigManager>(
  "@namera-ai/cli/ConfigManager",
);

/**
 * Live layer that persists CLI entities in the user's config directory.
 */
export const layer = Layer.effect(
  ConfigManager,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const getConfigDirPath = () =>
      Effect.gen(function* () {
        const homeDir = yield* Effect.sync(() => os.homedir());
        const baseDir = path.join(homeDir, ".namera");

        return baseDir;
      });

    const ensureConfigDirExists = () =>
      Effect.gen(function* () {
        const baseDir = yield* getConfigDirPath();

        const subDirs = ["smart-accounts", "session-keys", "keystores"];

        const directoriesToCreate = subDirs.map((dir) =>
          path.join(baseDir, dir),
        );

        yield* Effect.forEach(
          directoriesToCreate,
          (dirPath) =>
            fs.makeDirectory(dirPath, { recursive: true }).pipe(
              Effect.catchTag("PlatformError", (e) =>
                Effect.fail(
                  new ConfigManagerError({
                    code: "InitializationError",
                    message: e.message,
                  }),
                ),
              ),
            ),
          { concurrency: "unbounded" },
        );
      });

    const getEntityPath = <TEntityType extends EntityType>(
      entity: GetEntityParams<TEntityType>,
    ) =>
      Effect.gen(function* () {
        const baseDir = yield* getConfigDirPath();
        const entityPath = path.join(baseDir, `${entity.type}s`, entity.alias);
        return entityPath;
      });

    const checkEntityExists = <TEntityType extends EntityType>(
      entity: GetEntityParams<TEntityType>,
    ) =>
      Effect.gen(function* () {
        const entityPath = yield* getEntityPath(entity);
        const exists = yield* fs.exists(entityPath).pipe(
          Effect.catchTag("PlatformError", (e) =>
            Effect.fail(
              new ConfigManagerError({
                code: e.reason._tag,
                message: e.message,
              }),
            ),
          ),
        );

        return exists;
      });

    const getEntity = <TEntityType extends EntityType>(
      entity: GetEntityParams<TEntityType>,
    ) =>
      Effect.gen(function* () {
        const entityPath = yield* getEntityPath(entity);
        const exists = yield* checkEntityExists(entity);

        if (exists) {
          const content = yield* fs.readFileString(entityPath);

          return {
            alias: entity.alias,
            content,
            path: entityPath,
            type: entity.type,
          } satisfies Entity<TEntityType>;
        }

        return yield* Effect.fail(
          new ConfigManagerError({
            code: "EntityNotFound",
            message: `${entityName[entity.type]} with alias ${entity.alias} does not exist`,
          }),
        );
      }).pipe(
        Effect.catchTag("PlatformError", (e) =>
          Effect.fail(
            new ConfigManagerError({
              code: e.reason._tag,
              message: e.message,
            }),
          ),
        ),
      );

    const getEntitiesForType = <TEntityType extends EntityType>(
      type: TEntityType,
    ) =>
      Effect.gen(function* () {
        const baseDir = yield* getConfigDirPath();

        const entitiesDir = path.join(baseDir, `${type}s`);
        const entities = yield* fs.readDirectory(entitiesDir);

        const effects = entities.map((entityName) =>
          Effect.gen(function* () {
            const entityPath = path.join(entitiesDir, entityName);
            const content = yield* fs.readFileString(entityPath);

            return {
              alias: entityName,
              content,
              path: entityPath,
              type,
            } satisfies Entity<TEntityType>;
          }),
        );

        return yield* Effect.all(effects, { concurrency: "unbounded" });
      }).pipe(
        Effect.catchTag("PlatformError", (e) =>
          Effect.fail(
            new ConfigManagerError({
              code: e.reason._tag,
              message: e.message,
            }),
          ),
        ),
      );

    const storeEntity = <TEntityType extends EntityType>(
      entity: Entity<TEntityType>,
    ) =>
      Effect.gen(function* () {
        const entityPath = yield* getEntityPath(entity);

        const exists = yield* checkEntityExists({
          alias: entity.alias,
          type: entity.type,
        });

        if (exists) {
          return yield* Effect.fail(
            new ConfigManagerError({
              code: "EntityAlreadyExists",
              message: `Entity ${entity.alias} already exists`,
            }),
          );
        }

        yield* fs.writeFileString(entityPath, entity.content);

        return {
          alias: entity.alias,
          content: entity.content,
          path: entityPath,
          type: entity.type,
        } satisfies Entity<TEntityType>;
      }).pipe(
        Effect.catchTag("PlatformError", (e) =>
          Effect.fail(
            new ConfigManagerError({
              code: e.reason._tag,
              message: e.message,
            }),
          ),
        ),
      );

    return ConfigManager.of({
      checkEntityExists,
      ensureConfigDirExists,
      getConfigDirPath,
      getEntitiesForType,
      getEntity,
      getEntityPath,
      storeEntity,
    });
  }),
);
