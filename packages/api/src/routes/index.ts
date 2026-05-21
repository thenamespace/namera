import { HttpApi, OpenApi } from "effect/unstable/httpapi";

import { authGroup, magicLinkGroup } from "./auth";
import { healthGroup } from "./health";
// import { organizationGroup } from "./organization";
import { rpcGroup } from "./rpc";
import { smartAccountGroup } from "./smart-account";

export const api = HttpApi.make("NameraAPI")
  .add(healthGroup)
  .add(authGroup)
  .add(magicLinkGroup)
  // .add(organizationGroup)
  .add(smartAccountGroup)
  .add(rpcGroup)
  .annotate(OpenApi.Title, "Namera API")
  .annotate(OpenApi.Description, "Namera API")
  .annotate(OpenApi.License, {
    name: "Apache-2.0",
    url: "https://opensource.org/licenses/Apache-2.0",
  });
