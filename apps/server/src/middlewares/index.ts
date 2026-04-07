import { Layer } from "effect";

import { AuthMiddleware } from "./auth";
import { CorsMiddleware } from "./cors";
import { ScalarMiddleware } from "./scalar";
import { TracingMiddleware } from "./tracing";

export const Middlewares = ScalarMiddleware.pipe(
  Layer.provideMerge(AuthMiddleware),
  Layer.provide(CorsMiddleware),
  Layer.provide(TracingMiddleware),
);
