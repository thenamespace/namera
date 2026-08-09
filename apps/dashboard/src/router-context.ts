import type { AtomRegistry } from "effect/unstable/reactivity";

export interface RouterContext {
  readonly atomRegistry: AtomRegistry.AtomRegistry;
}
