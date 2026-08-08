import { HttpApiScalar } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";

export const ApiReferenceRoutes = HttpApiScalar.layer(NameraApi, {
  path: "/reference",
});
