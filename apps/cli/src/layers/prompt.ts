import { Data, Effect, Layer, type Redacted, ServiceMap } from "effect";
import type { QuitError } from "effect/Terminal";
import { Prompt } from "effect/unstable/cli";
import { type Hex, hexToBytes, isHex } from "viem";

import { type EntityType, entityName } from "@/types";

import { ConfigManager } from "./config";

/**
 * Effect service for interactive CLI prompts.
 */
export type PromptManager = {
  /**
   * Prompts for an alias and validates it against existing storage.
   *
   * @param params - Prompt text, entity type, and expected alias semantics.
   */
  aliasPrompt: (
    params: AliasPromptParams,
  ) => Effect.Effect<string, QuitError, Prompt.Environment>;
  /**
   * Prompts for a password, optionally validating the input.
   *
   * @param params - Prompt text and optional validator.
   * @returns The redacted password.
   */
  passwordPrompt: (
    params: PasswordPromptParams,
  ) => Effect.Effect<Redacted.Redacted<string>, QuitError, Prompt.Environment>;
  /**
   * Prompts the user to select a value from a list of choices.
   *
   * @param params - Selection prompt options and choices.
   * @returns The selected value.
   */
  selectPrompt: <const A>(
    params: Prompt.SelectOptions<A>,
  ) => Effect.Effect<A, QuitError, Prompt.Environment>;
  /**
   * Prompts the user to enter a hex value.
   *
   * @param params - Prompt text and expected length of the hex value.
   * @returns The hex value entered by the user.
   */
  hexPrompt: <TRedacted extends boolean>(
    params: HexPromptParams<TRedacted>,
  ) => Effect.Effect<
    TRedacted extends true ? Redacted.Redacted<Hex> : Hex,
    QuitError,
    Prompt.Environment
  >;
  /**
   * Prompt the user to select multiple options from a list.
   *
   * @param params - Prompt options and multi-select options.
   * @returns A list of selected options.
   */
  multiSelectPrompt: <const A>(
    params: Prompt.SelectOptions<A> & Prompt.MultiSelectOptions,
  ) => Effect.Effect<A[], QuitError, Prompt.Environment>;
};

/**
 * Service tag for resolving {@link PromptManager} from the Effect context.
 */
export const PromptManager = ServiceMap.Service<PromptManager>(
  "@namera-ai/cli/PromptManager",
);

/**
 * Domain error for prompt-related failures.
 */
export class PromptManagerError extends Data.TaggedError(
  "@namera-ai/cli/PromptManagerError",
)<{
  code: "";
  message: string;
}> {}

/**
 * Parameters for prompting a user for an entity alias.
 */
export type AliasPromptParams = {
  /**
   * Prompt message shown to the user.
   */
  message: string;
  /**
   * Entity type used to validate alias existence.
   */
  type: EntityType;
  /**
   * Whether the alias must be new or already exist.
   */
  aliasType: "new" | "existing";
};

/**
 * Parameters for prompting a user for a password.
 */
export type PasswordPromptParams = {
  /**
   * Prompt message shown to the user.
   */
  message: string;
  /**
   * Optional validator returning the original value or a failure message.
   */
  validate?: (v: string) => Effect.Effect<string, string, never>;
};

/**
 * Parameters for prompting a user for a hex value.
 */
export type HexPromptParams<TRedacted extends boolean> = {
  /**
   * Expected length of the hex value.
   */
  length: number;
  /**
   * Prompt message shown to the user.
   */
  message: string;
  /**
   * Whether the hex value should be redacted.
   */
  redacted: TRedacted;
};

/**
 * Live layer that validates and returns interactive prompt input.
 */
export const layer = Layer.effect(
  PromptManager,
  Effect.gen(function* () {
    const configManager = yield* ConfigManager;

    const aliasPrompt = (params: AliasPromptParams) =>
      Effect.gen(function* () {
        const alias = yield* Prompt.text({
          message: params.message,
          validate: (v) =>
            Effect.gen(function* () {
              if (v.trim() === "") {
                return yield* Effect.fail("Alias cannot be empty");
              }

              const exists = yield* configManager
                .checkEntityExists({
                  alias: v,
                  type: params.type,
                })
                .pipe(
                  Effect.catchTag("@namera-ai/cli/ConfigManagerError", (e) =>
                    Effect.fail(e.message),
                  ),
                );

              if (params.aliasType === "new" && exists) {
                return yield* Effect.fail(
                  `${entityName[params.type]} with alias ${v} already exists`,
                );
              }

              if (params.aliasType === "existing" && !exists) {
                return yield* Effect.fail(
                  `${entityName[params.type]} with alias ${v} does not exist`,
                );
              }

              return v;
            }),
        });

        return alias;
      });

    const passwordPrompt = (params: PasswordPromptParams) =>
      Effect.gen(function* () {
        const password = yield* Prompt.password({
          message: params.message,
          validate: (v) =>
            Effect.gen(function* () {
              if (v.trim() === "") {
                return yield* Effect.fail("Password cannot be empty");
              }

              if (params.validate) {
                return yield* params.validate(v);
              }

              return v;
            }),
        });

        return password;
      });

    const selectPrompt = <const A>(params: Prompt.SelectOptions<A>) =>
      Effect.gen(function* () {
        return yield* Prompt.select(params);
      });

    const multiSelectPrompt = <const A>(
      params: Prompt.SelectOptions<A> & Prompt.MultiSelectOptions,
    ) =>
      Effect.gen(function* () {
        return yield* Prompt.multiSelect(params);
      });

    function hexPrompt(
      params: HexPromptParams<true>,
    ): Effect.Effect<Redacted.Redacted<Hex>, QuitError, Prompt.Environment>;

    function hexPrompt(
      params: HexPromptParams<false>,
    ): Effect.Effect<Hex, QuitError, Prompt.Environment>;

    function hexPrompt(params: HexPromptParams<boolean>) {
      return Effect.gen(function* () {
        const validate = (v: string) =>
          Effect.gen(function* () {
            if (v.trim() === "") {
              return yield* Effect.fail("Hex cannot be empty");
            }

            if (!isHex(v)) {
              return yield* Effect.fail("Invalid hex value");
            }

            const len = hexToBytes(v).length;

            if (len !== params.length) {
              return yield* Effect.fail(
                `Hex value must be ${params.length} bytes`,
              );
            }

            return v;
          });

        if (params.redacted) {
          return yield* Prompt.password({
            message: params.message,
            validate,
          });
        }

        return yield* Prompt.text({
          message: params.message,
          validate,
        });
      });
    }

    return PromptManager.of({
      aliasPrompt,
      passwordPrompt,
      selectPrompt,
      hexPrompt,
      multiSelectPrompt,
    });
  }),
);
