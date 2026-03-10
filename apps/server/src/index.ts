import "dotenv/config";

import { BunRuntime } from "@effect/platform-bun";
import { AuthConfigLive, AuthLive } from "@repo/auth";
import { AdminDatabaseLive, DatabaseLive } from "@repo/database";
import { AuthRepoLive } from "@repo/domain/auth";
import { Layer } from "effect";

import { EnvLive } from "./env";
import { Middlewares } from "./middlewares";
import { HttpLive } from "./router";

const app = HttpLive.pipe(
  Layer.provideMerge(AuthConfigLive),
  Layer.provideMerge(Middlewares),
  Layer.provideMerge(AuthLive),
  Layer.provideMerge(AuthRepoLive),
  Layer.provideMerge(DatabaseLive),
  Layer.provideMerge(AdminDatabaseLive),
  Layer.provideMerge(EnvLive),
);

BunRuntime.runMain(Layer.launch(app));
