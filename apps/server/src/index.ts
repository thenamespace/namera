import "dotenv/config";

import { NodeRuntime } from "@effect/platform-node";
import { DatabaseLive } from "@repo/database";
import { Layer } from "effect";

import { EnvLive } from "./env";
import { HttpLive } from "./router";

const app = HttpLive.pipe(
  Layer.provideMerge(DatabaseLive),
  Layer.provideMerge(EnvLive),
);

NodeRuntime.runMain(Layer.launch(app));
