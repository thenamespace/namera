import { HttpApiBuilder, HttpApiScalar } from "@effect/platform";
import { Layer } from "effect";

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
const scalarMiddleware = HttpApiScalar.layer({
  path: "/docs",
});
const openApiMiddleware = HttpApiBuilder.middlewareOpenApi({
  path: "/openapi.json",
});

export const Middlewares = Layer.mergeAll(
  corsMiddleware,
  scalarMiddleware,
  openApiMiddleware,
);
