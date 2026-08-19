const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

/** Encodes text with the project-standard UTF-8 representation. */
export const encodeUtf8 = (value: string): Uint8Array<ArrayBuffer> => utf8Encoder.encode(value);

/** Decodes bytes with the project-standard UTF-8 representation. */
export const decodeUtf8 = (value: ArrayBuffer | Uint8Array<ArrayBuffer>): string =>
  utf8Decoder.decode(value);

export const utf8ByteLength = (value: string): number => encodeUtf8(value).byteLength;
