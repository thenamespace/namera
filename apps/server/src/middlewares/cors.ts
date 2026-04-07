import { HttpRouter } from "effect/unstable/http";

export const CorsMiddleware = HttpRouter.cors({
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
