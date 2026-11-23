/**
 * The ERC-4337 EntryPoint every supported account and bundler uses.
 *
 * **Details**
 *
 * Keyed by version (`0.7`). The addresses are the same on every chain Namera supports.
 *
 * @stability experimental
 * @category addresses
 * @since 0.1.0
 */
export const entryPoint = {
  "0.7": {
    "entryPoint": "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    "senderCreator": "0xEFC2c1444eBCC4Db75e7613d20C6a62fF67A167C"
  }
} as const

/**
 * ZeroDev's Kernel smart account: its factory, the staked FactoryStaker that accounts deploy
 * through, the implementation and the ECDSA validator, the owner's root validator.
 *
 * **Details**
 *
 * Keyed by version (`3.3`). The addresses are the same on every chain Namera supports.
 *
 * @stability experimental
 * @category addresses
 * @since 0.1.0
 */
export const kernel = {
  "3.3": {
    "factory": "0x2577507b78c2008Ff367261CB6285d44ba5eF2E9",
    "factoryStaker": "0xd703aaE79538628d27099B8c4f621bE4CCd142d5",
    "implementation": "0xd6CEDDe84be40893d153Be9d467CD6aD37875b28",
    "ecdsaValidator": "0x845ADb2C711129d4f3966735eD98a9F09fC4cE57"
  }
} as const

/**
 * Biconomy's Nexus smart account: its factory, implementation, bootstrap and default (K1)
 * validator.
 *
 * **Details**
 *
 * Keyed by version (`1.3.3`). The addresses are the same on every chain Namera supports.
 *
 * @stability experimental
 * @category addresses
 * @since 0.1.0
 */
export const nexus = {
  "1.3.3": {
    "factory": "0x0000b1C08f1418dA76B5E99c1Bf5718486cf8c53",
    "implementation": "0x0000B1c01cB3b5770D8806f0D214d50131a08a5B",
    "bootstrap": "0x0000B1c0A80cb7DD166a15e7390b8A4Ced4500C6",
    "k1Validator": "0x0000B1C0790E5a28293276C320d2B95D651dBaD6"
  }
} as const

/**
 * Safe 1.4.1 with Rhinestone's Safe7579 adapter: the Safe proxy factory and L2 singleton, the
 * adapter and its launchpad, and the OwnableValidator for the owners.
 *
 * **Details**
 *
 * Keyed by version (`2`). The addresses are the same on every chain Namera supports.
 *
 * @stability experimental
 * @category addresses
 * @since 0.1.0
 */
export const safe7579 = {
  2: {
    "proxyFactory": "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
    "singletonL2": "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762",
    "adapter": "0x7579f2AD53b01c3D8779Fe17928e0D48885B0003",
    "launchpad": "0x75798463024Bda64D83c94A64Bc7D7eaB41300eF",
    "ownableValidator": "0x000000000013fdB5234E4E3162a810F54d9f7E98"
  }
} as const
