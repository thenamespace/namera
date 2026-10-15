import type { ComponentProps } from "react";

import { InputOTP, REGEXP_ONLY_DIGITS } from "@thenamespace/uikit";

type SignInCodeInputProps = Omit<
  ComponentProps<typeof InputOTP>,
  "children" | "maxLength" | "pattern"
>;

export function SignInCodeInput(props: SignInCodeInputProps) {
  return (
    <InputOTP
      aria-label="Email sign-in code"
      autoComplete="one-time-code"
      inputMode="numeric"
      variant="secondary"
      {...props}
      maxLength={8}
      pattern={REGEXP_ONLY_DIGITS}
    >
      <InputOTP.Group className="gap-1">
        {[0, 1, 2, 3].map((index) => (
          <InputOTP.Slot key={index} index={index} className="h-10 w-6 min-[380px]:w-8" />
        ))}
      </InputOTP.Group>
      <InputOTP.Separator />
      <InputOTP.Group className="gap-1">
        {[4, 5, 6, 7].map((index) => (
          <InputOTP.Slot key={index} index={index} className="h-10 w-6 min-[380px]:w-8" />
        ))}
      </InputOTP.Group>
    </InputOTP>
  );
}

export type { SignInCodeInputProps };
