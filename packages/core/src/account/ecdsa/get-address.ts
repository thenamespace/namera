import * as ecdsa from "@zerodev/ecdsa-validator";
import { getEntryPoint } from "@zerodev/sdk/constants";
import type { Address, EntryPointVersion, Hex, PublicClient } from "viem";

import type { GetKernelVersion } from "@/types";

export type GetKernelAddressFromECDSAParams<
  TEntrypointVersion extends EntryPointVersion,
> = {
  entryPointVersion: TEntrypointVersion;
  kernelVersion: GetKernelVersion<TEntrypointVersion>;
  eoaAddress: Address;
  index: bigint;
  hookAddress?: TEntrypointVersion extends "0.6" ? never : Address;
  hookData?: TEntrypointVersion extends "0.6" ? never : Hex;
  initConfig?: TEntrypointVersion extends "0.6" ? never : Hex[];
} & (
  | { publicClient: PublicClient; initCodeHash?: never }
  | { publicClient?: never; initCodeHash: Hex }
);

export const getKernelAddressFromECDSA = async <
  TEntrypointVersion extends EntryPointVersion,
>(
  params: GetKernelAddressFromECDSAParams<TEntrypointVersion>,
): Promise<Address> => {
  const { entryPointVersion, ...rest } = params;
  const entryPoint = getEntryPoint(entryPointVersion);

  return await ecdsa.getKernelAddressFromECDSA({ entryPoint, ...rest });
};
