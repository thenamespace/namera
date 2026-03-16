import "dotenv/config";

import { BunRuntime } from "@effect/platform-bun";
import { Layer } from "effect";

import { HttpLive } from "./router";

const app = HttpLive;

BunRuntime.runMain(Layer.launch(app));
