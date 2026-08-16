export type NameraSdkErrorKind = "api" | "contract" | "network" | "unexpected";

export type NameraSdkError = {
  readonly kind: NameraSdkErrorKind;
  readonly message: string;
  readonly status: number | null;
  readonly code?: string;
  readonly tag?: string;
  readonly details?: unknown;
};

export type NameraResult<A> =
  | { readonly success: true; readonly data: A; readonly error: null }
  | { readonly success: false; readonly data: null; readonly error: NameraSdkError };

export const success = <A>(data: A): NameraResult<A> => ({ success: true, data, error: null });

export const failure = <A = never>(error: NameraSdkError): NameraResult<A> => ({
  success: false,
  data: null,
  error,
});
