import { Layer } from "effect";

import { AuthRepoLive } from "./auth";

export const DomainLive = Layer.mergeAll(AuthRepoLive);
