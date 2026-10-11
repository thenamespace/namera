import { Result, Schema } from "effect";

import { failure, success, type NameraResult } from "./result.js";

export const inputDecoder = <S extends Schema.Constraint>(schema: S) => {
  // Inputs are SDK values (including bigint), not their JSON wire representation.
  const decode = Schema.decodeUnknownResult(Schema.toType(schema));
  return (input: unknown): NameraResult<S["Type"]> => {
    const decoded = decode(input);
    if (Result.isFailure(decoded)) {
      return failure<S["Type"]>({
        kind: "contract",
        message: "The request did not match the Namera API contract.",
        status: null,
        cause: decoded.failure,
      });
    }
    return success(decoded.success);
  };
};
