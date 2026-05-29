import type { AtomRegistry } from "effect/unstable/reactivity";

import type { PropsWithChildren } from "react";

import { RegistryContext } from "@effect/atom-react";

export const AtomProvider = ({
  registry,
  children,
}: PropsWithChildren<{ registry: AtomRegistry.AtomRegistry }>) => {
  return (
    <RegistryContext.Provider value={registry}>
      {children}
    </RegistryContext.Provider>
  );
};
