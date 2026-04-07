export type TypedArray =
  | Uint8Array<ArrayBuffer>
  | Int8Array<ArrayBuffer>
  | Uint16Array<ArrayBuffer>
  | Int16Array<ArrayBuffer>
  | Uint32Array<ArrayBuffer>
  | Int32Array<ArrayBuffer>
  | Float32Array<ArrayBuffer>
  | Float64Array<ArrayBuffer>;

export type SHAFamily = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
export type EncodingFormat =
  | "hex"
  | "base64"
  | "base64url"
  | "base64urlnopad"
  | "none";
