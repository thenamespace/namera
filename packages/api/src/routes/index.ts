import { HttpApi, OpenApi } from "@effect/platform";

import { authGroup } from "./auth";
import { healthGroup } from "./health";
import { rpcGroup } from "./rpc";
import { smartAccountGroup } from "./smart-account";

export const api = HttpApi.make("NameraAPI")
  .add(healthGroup)
  .add(authGroup)
  .add(rpcGroup)
  .add(smartAccountGroup)
  .annotate(OpenApi.Title, "Namera API")
  .annotate(OpenApi.Description, "Namera API")
  .annotate(OpenApi.License, {
    name: "MIT",
    url: "https://opensource.org/licenses/MIT",
  });
