export type NameraSdkErrorKind = "api" | "contract" | "network" | "unexpected" | "signer";

export type NameraApiErrorCode<E> = E extends { readonly code: infer C extends string } ? C : never;

export type NameraApiErrorTag<E> = E extends { readonly _tag: infer T extends string } ? T : never;

export type NameraApiFailure<E> = {
  readonly kind: "api";
  readonly message: string;
  readonly status: number | null;
  readonly code?: NameraApiErrorCode<E>;
  readonly tag?: NameraApiErrorTag<E>;
  readonly cause: E;
};

export type NameraInfrastructureFailure = {
  readonly kind: Exclude<NameraSdkErrorKind, "api" | "signer">;
  readonly message: string;
  readonly status: number | null;
  readonly cause: unknown;
};

export type NameraLocalSignerFailure = {
  readonly kind: "signer";
  readonly code:
    | "LOCAL_SIGNER_REQUIRED"
    | "LOCAL_SIGNER_UNAVAILABLE"
    | "PREPARED_EXECUTION_INVALID"
    | "PREPARED_SIGNATURE_INVALID"
    | "LOCAL_SIGNATURE_INVALID";
  readonly message: string;
  readonly status: null;
  readonly cause: null;
};

export type NameraSdkError<E = never> =
  | NameraApiFailure<E>
  | NameraInfrastructureFailure
  | NameraLocalSignerFailure;

export type NameraResult<A, E = never> =
  | { readonly success: true; readonly data: A; readonly error: null }
  | { readonly success: false; readonly data: null; readonly error: NameraSdkError<E> };

export const success = <A, E = never>(data: A): NameraResult<A, E> => ({
  success: true,
  data,
  error: null,
});

export const failure = <A = never, E = never>(error: NameraSdkError<E>): NameraResult<A, E> => ({
  success: false,
  data: null,
  error,
});
