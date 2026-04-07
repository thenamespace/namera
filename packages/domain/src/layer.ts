import { Layer } from "effect";

import * as AuthRepo from "./auth";

export const layer = Layer.mergeAll(AuthRepo.layer);
