import { HttpApiError } from "effect/unstable/httpapi";

import { Forbidden, Unauthorized } from "@namera-ai/protocol";

export const CommonErrors = [Forbidden, HttpApiError.InternalServerError, Unauthorized];
