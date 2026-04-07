import { HttpApi, OpenApi } from "effect/unstable/httpapi";

import { authGroup, magicLinkGroup } from "./auth";
import { healthGroup } from "./health";
import { rpcGroup } from "./rpc";

export const api = HttpApi.make("NameraAPI")
  .add(healthGroup)
  .add(authGroup)
  .add(magicLinkGroup)
  .add(rpcGroup)
  .annotate(OpenApi.Title, "Namera API")
  .annotate(OpenApi.Description, "Namera API")
  .annotate(OpenApi.License, {
    name: "MIT",
    url: "https://opensource.org/licenses/MIT",
  });
