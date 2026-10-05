import type { AtomRegistry } from "effect/reactivity";

export interface RouterContext {
  readonly atomRegistry: AtomRegistry.AtomRegistry;
}
