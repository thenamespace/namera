import { Atom } from "effect/unstable/reactivity";

import { getCurrentUser, listSessions, listUserOrgs } from "@/actions";

import { atomKeys } from "../keys";
import { atomRuntime } from "../runtime";

export const authAtoms = {
  me: atomRuntime
    .atom(getCurrentUser)
    .pipe(Atom.withReactivity(atomKeys.auth.me), Atom.keepAlive),
  listSessions: atomRuntime
    .atom(listSessions)
    .pipe(Atom.withReactivity(atomKeys.auth.sessions)),
  organization: {
    listOrgsForUser: atomRuntime
      .atom(listUserOrgs)
      .pipe(Atom.withReactivity(atomKeys.organization.listUserOrgs)),
  },
};
