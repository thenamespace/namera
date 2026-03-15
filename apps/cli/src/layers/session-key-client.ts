import type { BaseKernelAccountClient } from "@namera-ai/core";
import { ServiceMap } from "effect";

export const SessionKeyClient =
  ServiceMap.Service<BaseKernelAccountClient>("SessionKeyClient");
