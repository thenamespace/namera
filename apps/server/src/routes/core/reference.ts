import { HttpApiScalar } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";

export const ApiReferenceRoutes = HttpApiScalar.layer(NameraApi, {
  path: "/reference",
});
