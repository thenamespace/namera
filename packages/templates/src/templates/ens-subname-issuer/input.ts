import { Schema } from "effect";

import { EthereumAddress } from "@namera-ai/protocol/evm";

import { ensNetworks } from "#/ens/deployments";
import { TemplateExpiry } from "#/inputs/expiry";

export const EnsSubnameIssuerInput = Schema.Struct({
  networks: Schema.Array(Schema.Literals(ensNetworks)).check(
    Schema.isMinLength(1, { message: "Choose a network." }),
    Schema.isMaxLength(1, { message: "Choose one network for this registry." }),
  ),
  subregistryAddress: Schema.String.pipe(Schema.decodeTo(EthereumAddress)).check(
    Schema.makeFilter((address) =>
      /^0x0{40}$/i.test(address) ? "Enter a nonzero registry address." : undefined,
    ),
  ),
  expiresAt: TemplateExpiry,
});
