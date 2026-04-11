import { Layer } from "effect";

import * as AuthRepo from "./auth";
import * as CoreRepo from "./core";

export const layer = Layer.mergeAll(AuthRepo.layer, CoreRepo.layer);
