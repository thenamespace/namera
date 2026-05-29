import { Atom } from "effect/unstable/reactivity";

import { getUserPreferences } from "@/actions";

import { atomKeys } from "../keys";
import { atomRuntime } from "../runtime";

export const coreAtoms = {
  userPreferences: {
    get: atomRuntime
      .atom(getUserPreferences)
      .pipe(Atom.withReactivity(atomKeys.userPreference.get), Atom.keepAlive),
  },
};
