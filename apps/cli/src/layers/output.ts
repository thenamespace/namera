import { Effect, Layer, ServiceMap } from "effect";
import { NdJson } from "json-nd";

import { prettyFormat } from "@/helpers/pretty";

/**
 * Effect service for formatting command output into CLI-friendly formats.
 */
export type OutputFormatter = {
  /**
   * Formats command output into a CLI-friendly string.
   *
   * @param data - The object or list of objects to format.
   * @param format - Output mode: pretty (human), json, or ndjson.
   */
  format: (
    data: object | object[],
    format: "pretty" | "json" | "ndjson",
  ) => Effect.Effect<string>;
};

/**
 * Service tag for resolving {@link OutputFormatter} from the Effect context.
 */
export const OutputFormatter = ServiceMap.Service<OutputFormatter>(
  "@namera-ai/cli/OutputFormatter",
);

/**
 * Live layer that formats output as pretty, JSON, or NDJSON.
 */
export const layer = Layer.succeed(
  OutputFormatter,
  OutputFormatter.of({
    format: (data, format) =>
      Effect.gen(function* () {
        if (format === "pretty") {
          return prettyFormat(data);
        }
        if (format === "json") {
          return JSON.stringify(data, null, 2);
        }

        if (Array.isArray(data)) {
          return NdJson.stringify(data);
        }

        return NdJson.stringify([data]);
      }),
  }),
);
