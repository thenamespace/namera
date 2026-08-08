import { HttpRouter, HttpServerResponse } from "effect/unstable/http";

export const RootRoutes = HttpRouter.add("GET", "/", HttpServerResponse.text("Namera API"));
