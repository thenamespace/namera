import { HttpApi, OpenApi } from "@effect/platform";

import { authGroup } from "./auth";
import { healthGroup } from "./health";

export const api = HttpApi.make("RepoAPI")
  .add(healthGroup)
  .add(authGroup)
  .annotate(OpenApi.Title, "Repo API")
  .annotate(OpenApi.Description, "Repo API")
  .annotate(OpenApi.License, {
    name: "MIT",
    url: "https://opensource.org/licenses/MIT",
  });
