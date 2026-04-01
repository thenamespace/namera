import { Effect } from "effect";
import { Toolkit } from "effect/unstable/ai";

import { ReadContractTool, readContractToolHandler } from "./read-contract";

export const ReadTools = Toolkit.make(ReadContractTool);
export const ReadToolsHandlers = ReadTools.toLayer(
  Effect.succeed({
    read_contract: (params) => readContractToolHandler(params),
  }),
);
