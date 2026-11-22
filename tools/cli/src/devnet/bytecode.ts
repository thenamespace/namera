import * as Arr from "effect/Array"
import * as Formatter from "effect/Formatter"
import * as Order from "effect/Order"

/** Runtime code to place at a fixed address on the test chain with `anvil_setCode`. */
export interface CodeFixture {
  readonly name: string
  readonly address: string
  readonly code: string
}

/** A Namera contract the test chain deploys through the CREATE2 factory. */
export interface DeployedContract {
  readonly label: string
  readonly salt: string
  readonly address: string
  readonly initcode: string
}

/** Parses a fixture file name, `<name>@<address>.hex`. */
export const parseFixtureName = (file: string): { readonly name: string; readonly address: string } | undefined => {
  const match = /^(?<name>[a-z0-9.-]+)@(?<address>0x[0-9a-fA-F]{40})\.hex$/.exec(file)
  return match?.groups === undefined ? undefined : { name: match.groups["name"]!, address: match.groups["address"]! }
}

/**
 * Renders `src/internal/bytecode.ts` of `@namera-ai/devnet`: the code `Devnet` installs, so the devnet works without
 * a Foundry build or the fixture files at run time.
 */
export const renderDevnetBytecode = (
  fixtures: ReadonlyArray<CodeFixture>,
  contracts: ReadonlyArray<DeployedContract>
): string => {
  const sorted = Arr.sort(fixtures, Order.mapInput(Order.String, (fixture: CodeFixture) => fixture.name))
  const entry = (fields: Record<string, string>) =>
    `  { ${
      Arr.join(Arr.map(Object.entries(fields), ([key, value]) => `${key}: ${Formatter.formatJson(value)}`), ", ")
    } }`

  return Arr.join(
    [
      "// Written by `namera-dev devnet bytecode` from contracts/test/fixtures/accounts and the Foundry build; do not edit.",
      "",
      "/** @internal */",
      "export const fixtures: ReadonlyArray<{ readonly name: string; readonly address: `0x${string}`; readonly code: `0x${string}` }> = [",
      Arr.join(Arr.map(sorted, ({ address, code, name }) => entry({ name, address, code })), ",\n"),
      "]",
      "",
      "/** @internal */",
      "export const contracts: ReadonlyArray<{ readonly label: string; readonly salt: `0x${string}`; readonly address: `0x${string}`; readonly initcode: `0x${string}` }> = [",
      Arr.join(
        Arr.map(contracts, ({ address, initcode, label, salt }) => entry({ label, salt, address, initcode })),
        ",\n"
      ),
      "]",
      ""
    ],
    "\n"
  )
}
