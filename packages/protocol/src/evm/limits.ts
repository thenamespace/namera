export const EVM_MAX_CALLS = 32;
export const EVM_MAX_CALL_DATA_BYTES = 32 * 1024;
export const EVM_MAX_AGGREGATE_CALL_DATA_BYTES = 128 * 1024;
export const EVM_MAX_RETURN_DATA_BYTES = 32 * 1024;
export const EVM_MAX_AGGREGATE_RETURN_DATA_BYTES = 128 * 1024;
export const EVM_MAX_SIGNATURE_PAYLOAD_BYTES = 64 * 1024;

export const evmHexByteLength = (value: string): number => (value.length - 2) / 2;
