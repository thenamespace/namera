import { scheduleTask } from "@effect/atom-react";

import { Atom } from "effect/unstable/reactivity";
import { AtomRegistry } from "effect/unstable/reactivity";

import { Layers } from "./layers";

export const atomRegistry = AtomRegistry.make({
  scheduleTask,
  defaultIdleTTL: 5 * 60 * 1000,
});

export const atomRuntime = Atom.runtime(Layers);
