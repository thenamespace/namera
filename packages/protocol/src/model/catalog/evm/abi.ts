import { Schema } from "effect";

export interface EvmAbiParameter {
  readonly name: string;
  readonly type: string;
  readonly internalType?: string;
  readonly components?: readonly EvmAbiParameter[];
}

const widths = Array.from({ length: 32 }, (_, i) => (i + 1) * 8).join("|");
const solidityType = new RegExp(
  `^(?:address|bool|string|function|bytes(?:[1-9]|[12][0-9]|3[0-2])?|u?int(?:${widths})?|u?fixed(?:(?:${widths})x(?:[1-9]|[1-7][0-9]|80))?|tuple)(?:\\[(?:[1-9][0-9]*)?\\])*$`,
);

const tupleComponents = Schema.makeFilter<EvmAbiParameter>(
  (parameter) => parameter.type.startsWith("tuple") === (parameter.components !== undefined),
  { message: "Only tuple parameters must provide components" },
);

// Bound tuple depth before descending into untrusted ABI input.
const parameterFields = (depth: number) => ({
  name: Schema.String,
  type: Schema.String.check(Schema.isMaxLength(256), Schema.isPattern(solidityType)),
  internalType: Schema.optionalKey(Schema.String),
  components: Schema.optionalKey(
    depth === 0
      ? Schema.Never
      : Schema.Array(parameterSchema(depth - 1)).check(Schema.isMaxLength(256)),
  ),
});

function parameterSchema(depth: number): Schema.Codec<EvmAbiParameter> {
  return Schema.Struct(parameterFields(depth)).check(tupleComponents);
}

const parameters = Schema.Array(parameterSchema(8)).check(Schema.isMaxLength(256));
const eventParameters = Schema.Array(
  Schema.Struct({ ...parameterFields(8), indexed: Schema.Boolean }).check(tupleComponents),
).check(Schema.isMaxLength(256));

export const EvmJsonAbi = Schema.Array(
  Schema.Union([
    Schema.Struct({
      type: Schema.Literal("function"),
      name: Schema.String.check(Schema.isMinLength(1)),
      inputs: parameters,
      outputs: parameters,
      stateMutability: Schema.Literals(["pure", "view", "nonpayable", "payable"]),
    }),
    Schema.Struct({
      type: Schema.Literal("constructor"),
      inputs: parameters,
      stateMutability: Schema.Literals(["nonpayable", "payable"]),
    }),
    Schema.Struct({
      type: Schema.Literal("event"),
      name: Schema.String.check(Schema.isMinLength(1)),
      inputs: eventParameters,
      anonymous: Schema.Boolean,
    }),
    Schema.Struct({
      type: Schema.Literal("error"),
      name: Schema.String.check(Schema.isMinLength(1)),
      inputs: parameters,
    }),
    Schema.Struct({
      type: Schema.Literal("fallback"),
      stateMutability: Schema.Literals(["nonpayable", "payable"]),
    }),
    Schema.Struct({
      type: Schema.Literal("receive"),
      stateMutability: Schema.Literal("payable"),
    }),
  ]),
).check(Schema.isMaxLength(2048));

export type EvmJsonAbi = typeof EvmJsonAbi.Type;
