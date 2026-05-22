import { mergeQueryKeys } from "@lukemorales/query-key-factory";

import { authQuery } from "./auth";
import { organizationQuery } from "./organization";

export const queries = mergeQueryKeys(authQuery, organizationQuery);
