import { Layer } from "effect";

// import { CorsMiddleware } from "./cors";

import { ScalarMiddleware } from "./scalar";
import { TracingMiddleware } from "./tracing";

export const Middlewares = ScalarMiddleware.pipe(
  //   Layer.provide(CorsMiddleware),
  Layer.provide(TracingMiddleware),
);
