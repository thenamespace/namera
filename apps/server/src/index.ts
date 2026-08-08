import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";

import { ServerLive } from "#/layers/index";

Layer.launch(ServerLive).pipe(NodeRuntime.runMain);
