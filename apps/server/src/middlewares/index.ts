import {
  HttpApiBuilder,
  HttpApiScalar,
  HttpMiddleware,
} from "@effect/platform";
import { Layer } from "effect";

import { authorizationMiddleware } from "./auth";

const corsMiddleware = HttpApiBuilder.middlewareCors({
  allowedHeaders: [
    "Content-Type",
    "Accept",
    "Authorization",
    "Traceparent",
    "b3",
  ],
  allowedMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedOrigins: ["http://localhost:3000"],
  credentials: true,
});

export const scalarMiddleware = HttpApiScalar.layer({
  path: "/docs",
});
export const openApiMiddleware = HttpApiBuilder.middlewareOpenApi({
  path: "/openapi.json",
});

export const Middlewares = Layer.mergeAll(
  corsMiddleware,
  authorizationMiddleware,
);
