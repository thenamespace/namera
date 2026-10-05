import { HttpRouter, HttpServerResponse } from "effect/http";

export const RootRoutes = HttpRouter.add("GET", "/", HttpServerResponse.text("Namera API"));
