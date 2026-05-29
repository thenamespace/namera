import { Atom } from "effect/unstable/reactivity";

import { getIpLocation } from "@/actions";

import { atomKeys } from "../keys";
import { atomRuntime } from "../runtime";

export const miscAtoms = {
  ipLocation: Atom.family((ipAddress?: string) =>
    atomRuntime
      .atom(getIpLocation(ipAddress))
      .pipe(Atom.withReactivity(atomKeys.misc.ipLocation(ipAddress))),
  ),
};
