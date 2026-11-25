import * as Arr from "effect/Array"
import * as Formatter from "effect/Formatter"
import * as Predicate from "effect/Predicate"
import * as Rec from "effect/Record"
import * as Str from "effect/String"

import type { ChainDeployments, DeploymentRecord, ExternalConfig } from "./schema.ts"
import { type BuiltContract, factory } from "./workspace.ts"

const since = "2.0.0"
const width = 100

const wrap = (paragraph: string) => {
  const lines: Array<string> = []
  for (const word of Str.split(paragraph, " ")) {
    const last = lines.at(-1)
    if (last !== undefined && ` * ${last} ${word}`.length <= width) {
      lines[lines.length - 1] = `${last} ${word}`
    } else lines.push(word)
  }
  return lines
}

const docComment = (paragraphs: ReadonlyArray<string>, tags: ReadonlyArray<string>) =>
  Arr.join(
    [
      "/**",
      ...Arr.flatMap(paragraphs, (paragraph, index) => [
        ...(index === 0 ? [] : [" *"]),
        ...Arr.map(wrap(paragraph), (line) => ` * ${line}`)
      ]),
      " *",
      ...Arr.map(tags, (tag) => ` * ${tag}`),
      " */"
    ],
    "\n"
  )

type Identifier = { readonly _tag: "Identifier"; readonly name: string }

const identifier = (name: string) => ({ _tag: "Identifier", name }) satisfies Identifier

const literal: (value: unknown) => string = (value) => {
  if (Predicate.isTagged(value, "Identifier") && Predicate.hasProperty(value, "name")) {
    return String(value.name)
  }
  // A call rather than a literal: the repository lints out bigint literals (`effect/no-bigint-literals`). Marked pure,
  // or esbuild keeps every deployment record, which holds it, even when only an address is imported.
  if (Predicate.isBigInt(value)) return `/* @__PURE__ */ BigInt("${value}")`
  if (Arr.isArray(value)) return `[${Arr.join(Arr.map(value, literal), ", ")}]`
  if (Predicate.isObject(value)) {
    const fields = Arr.map(
      Rec.toEntries(value),
      ([key, field]) => `${/^[0-9]+$/.test(key) ? key : Formatter.formatJson(key)}: ${literal(field)}`
    )
    return `{${Arr.join(fields, ", ")}}`
  }
  return Formatter.formatJson(value)
}

const hex = Arr.join(["`0x", "$", "{string}`"], "")

const contractModule = Arr.join(
  [
    docComment(
      [
        "The compiler settings a contract version was built with. They are part of its initcode, so they fix its CREATE2 address."
      ],
      ["@stability experimental", "@category models", `@since ${since}`]
    ),
    "export interface Compiler {",
    "  readonly compiler: string;",
    "  readonly evmVersion: string;",
    "  readonly optimizerRuns: number;",
    "  readonly viaIR: boolean;",
    "}",
    "",
    docComment(
      [
        "The provenance of a contract version on one chain: the hash of the runtime code read from the chain, the source commit and compiler it was built from, and the transaction that created it.",
        "**Gotchas**",
        "The transaction fields are absent when the code was already on chain before Namera's deploy pipeline ran there: anyone can deploy the same initcode through the CREATE2 factory."
      ],
      ["@stability experimental", "@category models", `@since ${since}`]
    ),
    "export interface Deployment {",
    `  readonly runtimeCodeHash: ${hex};`,
    `  readonly transactionHash?: ${hex};`,
    "  readonly blockNumber?: bigint;",
    `  readonly blockHash?: ${hex};`,
    `  readonly deployer?: ${hex};`,
    "  readonly source: Compiler & { readonly commit: string };",
    "}",
    "",
    docComment(
      [
        "One version of a Namera contract: its versioned label, CREATE2 inputs and address, ABI, and its deployment on each chain, keyed by chain id.",
        "**Details**",
        "The address is the same on every chain. During the alpha a changed contract keeps its label and gets a new address, listed only on the chains it has been redeployed to; from the first stable release, a changed contract gets a new label and therefore a new version, and a version never changes after its first deployment."
      ],
      ["@stability experimental", "@category models", `@since ${since}`]
    ),
    "export interface Version<Abi> {",
    "  readonly label: string;",
    `  readonly address: ${hex};`,
    `  readonly factory: ${hex};`,
    `  readonly salt: ${hex};`,
    `  readonly initcodeHash: ${hex};`,
    "  readonly compiler: Compiler;",
    "  readonly abi: Abi;",
    "  readonly deployments: Readonly<Partial<Record<number, Deployment>>>;",
    "}",
    ""
  ],
  "\n"
)

const deploymentSource = (record: DeploymentRecord) => ({
  runtimeCodeHash: record.runtimeCodeHash,
  ...(record.transaction === undefined
    ? {}
    : {
      transactionHash: record.transaction.transactionHash,
      blockNumber: BigInt(record.transaction.blockNumber),
      blockHash: record.transaction.blockHash,
      deployer: record.transaction.deployer
    }),
  source: record.source
})

const versionSource = (contract: BuiltContract, deployments: ReadonlyArray<ChainDeployments>) => {
  const deployed = Arr.flatMap(deployments, ({ chainId, contracts }) => {
    const record = contracts[contract.label]
    return record === undefined ? [] : [[String(chainId), deploymentSource(record)] as const]
  })
  const suffix = `V${contract.version}`
  const errors = Arr.filter(contract.abi, (item) => Predicate.hasProperty(item, "type") && item.type === "error")
  const { compiler } = contract
  const subject = `version ${contract.version} of Namera's \`${contract.contract}\` contract (\`${contract.label}\`)`
  const flatTags = ["@stability experimental", "@category contracts", `@since ${since}`]

  return Arr.join(
    [
      docComment(
        [
          `The ABI of ${subject}: \`v${contract.version}.abi\`, exported on its own so a bundler keeps only what is imported.`
        ],
        flatTags
      ),
      `export const abi${suffix} = ${literal(contract.abi)} as const;`,
      "",
      docComment(
        [
          `The error fragments of \`abi${suffix}\`, in ABI order: what decoding a revert needs, without the rest of the ABI.`
        ],
        flatTags
      ),
      `export const errors${suffix} = ${literal(errors)} as const;`,
      "",
      docComment(
        [`The CREATE2 address of ${subject}, the same on every chain: \`v${contract.version}.address\`.`],
        flatTags
      ),
      `export const address${suffix} = ${literal(contract.address)} as const;`,
      "",
      docComment(
        [
          `The record of every chain ${subject} is deployed on, keyed by chain id: \`v${contract.version}.deployments\`.`
        ],
        flatTags
      ),
      `export const deployments${suffix}: Contract.Version<typeof abi${suffix}>["deployments"] = ${
        literal(Rec.fromEntries(deployed))
      };`,
      "",
      docComment(
        [
          `Version ${contract.version} of Namera's \`${contract.contract}\` contract (\`${contract.label}\`): its ABI, CREATE2 address and the record of every chain it is deployed on.`,
          "**Details**",
          `The address commits to the salt \`keccak256(label)\` and to the initcode built with solc ${compiler.compiler} for \`${compiler.evmVersion}\` (${compiler.optimizerRuns} optimizer runs, ${
            compiler.viaIR ? "via-IR" : "legacy pipeline"
          }), so it is the same on every chain.`
        ],
        flatTags
      ),
      `export const v${contract.version}: Contract.Version<typeof abi${suffix}> = ${
        literal({
          label: contract.label,
          address: identifier(`address${suffix}`),
          factory,
          salt: contract.salt,
          initcodeHash: contract.initcodeHash,
          compiler,
          abi: identifier(`abi${suffix}`),
          deployments: identifier(`deployments${suffix}`)
        })
      };`,
      ""
    ],
    "\n"
  )
}

const namespaceExport = (name: string, summary: string, typeOnly: boolean) =>
  Arr.join(
    [
      docComment([summary], ["@stability experimental", `@since ${since}`]),
      `export ${typeOnly ? "type " : ""}* as ${name} from "./${name}.ts";`,
      ""
    ],
    "\n"
  )

const externalModule = (external: ExternalConfig) =>
  Arr.join(
    Arr.map(Rec.toEntries(external), ([group, { description, versions }]) =>
      Arr.join(
        [
          docComment(
            [
              description,
              "**Details**",
              `Keyed by version (${
                Arr.join(Arr.map(Rec.keys(versions), (version) => `\`${version}\``), ", ")
              }). The addresses are the same on every chain Namera supports.`
            ],
            ["@stability experimental", "@category addresses", `@since ${since}`]
          ),
          `export const ${group} = ${literal(versions)} as const;`,
          ""
        ],
        "\n"
      )),
    "\n"
  )

/**
 * The source files of `@namera-ai/contracts`, by file name: the `Contract` types, one module per
 * contract with one export per version, `External` with the addresses Namera builds on, and an
 * index re-exporting each module as a namespace. Unformatted; dprint formats them.
 */
export const packageSources = (
  contracts: ReadonlyArray<BuiltContract>,
  deployments: ReadonlyArray<ChainDeployments>,
  external: ExternalConfig
) => {
  const names = Arr.dedupe(Arr.map(contracts, (contract) => contract.contract))

  const modules = Arr.map(names, (name) => {
    const versions = Arr.filter(contracts, (contract) => contract.contract === name)
    const body = Arr.join(
      Arr.map(versions, (version) => versionSource(version, deployments)),
      "\n"
    )
    return [`${name}.ts`, `import type * as Contract from "./Contract.ts";\n\n${body}`] as const
  })

  const index = Arr.join(
    [
      namespaceExport(
        "Contract",
        "The shapes every generated contract module shares: a contract `Version`, its `Deployment` on a chain and the `Compiler` settings it was built with.",
        true
      ),
      ...Arr.map(names, (name) =>
        namespaceExport(
          name,
          `Namera's \`${name}\` contract: ABI, CREATE2 address and deployment records, one export per version (\`${name}.v1\`, …) and one per part of it (\`${name}.addressV1\`, …).`,
          false
        )),
      namespaceExport(
        "External",
        "The contracts Namera builds on but does not deploy, by version: EntryPoint 0.7 and Kernel 3.3's factory, factory staker, implementation and ECDSA validator.",
        false
      )
    ],
    "\n"
  )

  return new Map<string, string>([
    ["Contract.ts", contractModule],
    ...modules,
    ["External.ts", externalModule(external)],
    ["index.ts", index]
  ])
}
