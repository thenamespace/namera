import { Controller, type UseFormReturn } from "react-hook-form";

import { HeadingGroup } from "@/components/misc";
import { SupportedChain, supportedChains } from "@namera-ai/schema";
import { Card, CardContent } from "@namera-ai/ui/components/ui/card";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@namera-ai/ui/components/ui/field";
import {
  MultiSelect,
  type MultiSelectGroup,
} from "@namera-ai/ui/components/ui/multi-select";
import { ChainIcon } from "@namera-ai/ui/icons";

import type { NewSessionKeyFormSchema } from "./schema";

type FormProps = {
  form: UseFormReturn<NewSessionKeyFormSchema>;
};

const chains: MultiSelectGroup[] = [
  {
    heading: "Mainnet Chains",
    options: Object.values(supportedChains)
      .filter((c) => !c.testnet)
      .map((c) => ({
        value: c.key,
        label: c.name,
        icon: () => (
          <ChainIcon chain={c.key as SupportedChain} className="rounded-full" />
        ),
      })),
  },
  {
    heading: "Testnet Chains",
    options: Object.values(supportedChains)
      .filter((c) => c.testnet)
      .map((c) => ({
        value: c.key,
        label: c.name,
        icon: () => (
          <ChainIcon chain={c.key as SupportedChain} className="rounded-full" />
        ),
      })),
  },
];

export const Chains = ({ form }: FormProps) => {
  return (
    <div className="flex flex-col gap-4 py-4">
      <HeadingGroup heading="Chains" className="pb-0" />
      <Card className="py-0">
        <CardContent>
          <Controller
            name="chains"
            control={form.control}
            render={({ field, fieldState }) => {
              const isInvalid = fieldState.invalid;
              return (
                <Field data-invalid={isInvalid} className="py-3">
                  <div className="flex flex-row items-start justify-between">
                    <FieldLabel htmlFor={field.name}>Chains</FieldLabel>
                    <MultiSelect
                      animationConfig={{
                        badgeAnimation: "none",
                        optionHoverAnimation: "none",
                        popoverAnimation: "none",
                        delay: 0,
                      }}
                      options={chains}
                      defaultValue={["eth-mainnet"]}
                      placeholder="Select chains"
                      className=""
                      maxWidth="24rem"
                      value={field.value}
                      onValueChange={(v) => field.onChange(v)}
                    />
                  </div>
                  {isInvalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              );
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};
