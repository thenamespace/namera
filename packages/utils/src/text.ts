const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

export const encodeUtf8 = (value: string): Uint8Array<ArrayBuffer> => utf8Encoder.encode(value);

export const decodeUtf8 = (value: ArrayBuffer | Uint8Array<ArrayBuffer>): string =>
  utf8Decoder.decode(value);

export const utf8ByteLength = (value: string): number => encodeUtf8(value).byteLength;
