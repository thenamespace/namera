import "dotenv/config";

import { BunRuntime } from "@effect/platform-bun";
import { AuthConfigLive, AuthLive } from "@namera-ai/auth";
import { AdminDatabaseLive, DatabaseLive } from "@namera-ai/database";
import { AuthRepoLive, SessionJanitorLive } from "@namera-ai/domain/auth";
import { OtelLive } from "@namera-ai/telemetry";
import { Layer } from "effect";

import { EnvLive } from "./env";
import { Middlewares } from "./middlewares";
import { HttpLive } from "./router";

const app = HttpLive.pipe(
  Layer.provide(OtelLive),
  Layer.provideMerge(SessionJanitorLive),
  Layer.provideMerge(AuthConfigLive),
  Layer.provideMerge(Middlewares),
  Layer.provideMerge(AuthLive),
  Layer.provideMerge(AuthRepoLive),
  Layer.provideMerge(DatabaseLive),
  Layer.provideMerge(AdminDatabaseLive),
  Layer.provideMerge(EnvLive),
);

BunRuntime.runMain(Layer.launch(app));
