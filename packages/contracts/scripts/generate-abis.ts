import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Array as Arr, Effect, FileSystem, Schema } from "effect";

const foundryOut = "../../contracts/out";
const abiDir = "src/abis";

const contracts = [
  {
    artifact: "SmartSession.sol/SmartSession.json",
    contract: "SmartSession",
    name: "smartSession",
    file: "smart-session",
  },
  {
    artifact: "ECDSASessionValidator.sol/ECDSASessionValidator.json",
    contract: "ECDSASessionValidator",
    name: "ecdsaSessionValidator",
    file: "ecdsa-session-validator",
  },
] as const;

const Artifact = Schema.fromJsonString(Schema.Struct({ abi: Schema.Array(Schema.Unknown) }));
const AbiJson = Schema.fromJsonString(Schema.Array(Schema.Unknown));

const abiModule = (contract: string, name: string, abiJson: string) =>
  Arr.join(
    [
      "/**",
      ` * ABI of Namera's \`${contract}\` contract, generated from the Foundry build.`,
      " *",
      " * @stability experimental",
      " * @category abis",
      " * @since 0.1.0",
      " */",
      `export const ${name}Abi = ${abiJson} as const;`,
      "",
    ],
    "\n",
  );

const generate = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;

  yield* fs.makeDirectory(abiDir, { recursive: true });

  for (const { artifact, contract, name, file } of contracts) {
    const { abi } = yield* fs
      .readFileString(`${foundryOut}/${artifact}`)
      .pipe(Effect.flatMap(Schema.decodeEffect(Artifact)));
    const abiJson = yield* Schema.encodeEffect(AbiJson)(abi);

    yield* fs.writeFileString(`${abiDir}/${file}.ts`, abiModule(contract, name, abiJson));
  }
});

generate.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
