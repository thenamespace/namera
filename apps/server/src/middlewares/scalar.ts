import { HttpApiScalar } from "effect/unstable/httpapi";

import { api } from "@namera-ai/api";

export const ScalarMiddleware = HttpApiScalar.layer(api, {
  path: "/docs",
});
