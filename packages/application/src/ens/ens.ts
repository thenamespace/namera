import { Effect } from "effect";

import { Ens } from "@namera-ai/ens";
import { EnsUnavailableError, type EnsLabel } from "@namera-ai/protocol";

import { toEnsName } from "./data.js";

export const makeEnsApplication = Effect.gen(function* () {
  const ens = yield* Ens;

  const isNameAvailable = Effect.fn("application.ens.isNameAvailable")(function* (input: {
    readonly label: EnsLabel;
  }) {
    const name = toEnsName(input.label);
    const result = yield* ens
      .isSubnameAvailable(name)
      .pipe(Effect.mapError(() => new EnsUnavailableError({ code: "ENS_UNAVAILABLE" })));

    return {
      label: input.label,
      name,
      available: result.isAvailable,
    };
  });

  return { isNameAvailable } as const;
});

export type EnsApplication = Effect.Success<typeof makeEnsApplication>;
