import { mergeQueryKeys } from "@lukemorales/query-key-factory";

import { authQuery } from "./auth";
import { miscQuery } from "./misc";
import { organizationQuery } from "./organization";
import { userPreferenceQuery } from "./user-preference";

export const queries = mergeQueryKeys(
  authQuery,
  organizationQuery,
  userPreferenceQuery,
  miscQuery,
);
