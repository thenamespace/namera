import * as Address from "ox/Address"
import * as ContractAddress from "ox/ContractAddress"
import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"

// Solady's `LibClone` ERC-1967 proxy initcode, around the implementation address. Kernel's factory deploys its
// accounts as these proxies with CREATE2.
const prefix = "0x603d3d8160223d3973"
const suffix =
  "0x60095155f3363d3d373d3d363d7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc545af43d6000803e6038573d6000fd5b3d6000f3"

/**
 * The address a Solady ERC-1967 factory deploys `implementation` to with the CREATE2 salt `salt`.
 *
 * @internal
 */
export const predictAddress = (options: {
  readonly factory: Hex.Hex
  readonly implementation: Hex.Hex
  readonly salt: Hex.Hex
}): Hex.Hex =>
  Address.checksum(ContractAddress.fromCreate2({
    from: options.factory,
    salt: options.salt,
    bytecodeHash: Hash.keccak256(Hex.concat(prefix, options.implementation, suffix))
  }))
