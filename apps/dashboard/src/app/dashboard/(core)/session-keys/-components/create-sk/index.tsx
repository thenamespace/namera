import { Link } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";

import {
  SessionKeyMetadata,
  SupportedChain,
  supportedChains,
  type ChainWithMetadata,
} from "@namera-ai/schema";
import { Button } from "@namera-ai/ui/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxValue,
  useComboboxAnchor,
} from "@namera-ai/ui/components/ui/combobox";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@namera-ai/ui/components/ui/field";
import { IconPicker } from "@namera-ai/ui/components/ui/icon-picker";
import { Input } from "@namera-ai/ui/components/ui/input";
import { Textarea } from "@namera-ai/ui/components/ui/textarea";

const NewSessionKeyFormSchema = Schema.Struct({
  metadata: SessionKeyMetadata,
  chains: Schema.Array(SupportedChain),
});

type NewSessionKeyFormSchema = typeof NewSessionKeyFormSchema.Type;

const chains = [
  {
    value: "Mainnet Chains",
    items: Object.values(supportedChains).filter((c) => !c.testnet),
  },
  {
    value: "Testnet Chains",
    items: Object.values(supportedChains).filter((c) => c.testnet),
  },
];

const handleSubmit = async (value: NewSessionKeyFormSchema) => {
  console.log(value);
};

export const NewSessionKeyForm = () => {
  const anchor = useComboboxAnchor();

  const form = useForm<NewSessionKeyFormSchema>({
    defaultValues: {
      metadata: {
        icon: {
          type: "icon",
          value: "key",
        },
        name: "",
        description: "",
      },
      chains: ["eth-mainnet"],
    },
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(NewSessionKeyFormSchema),
    ),
  });

  return (
    <form
      className="flex w-full flex-col gap-4"
      id="new-account-form"
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <div className="flex flex-col gap-2 px-1">
        <div className="text-2xl">Create a new session key</div>
        <p className="text-muted-foreground text-sm">
          Create a new Session Key across multiple chains with fine-grained
          permissions.
        </p>
      </div>
      <div className="bg-card flex flex-col divide-y rounded-xl border px-4">
        <Controller
          name="metadata.icon"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="flex flex-row py-3">
                <FieldLabel htmlFor={field.name}>Icon</FieldLabel>
                <IconPicker
                  value={field.value}
                  onChange={(icon) => field.onChange(icon)}
                />
                {isInvalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            );
          }}
        />
        <Controller
          name="metadata.name"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="py-3">
                <div className="flex flex-row items-center justify-between">
                  <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                  <Input
                    className="max-w-48"
                    id={field.name}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="eg. ENS Session Key"
                    autoComplete="off"
                  />
                </div>
                {isInvalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            );
          }}
        />
        <Controller
          name="metadata.description"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="py-3">
                <div className="flex flex-row items-start justify-between">
                  <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                  <Textarea
                    className="max-w-[20rem]"
                    id={field.name}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="eg. Session key for performing ENS Renewals and Transfers"
                    autoComplete="off"
                  />
                </div>
                {isInvalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            );
          }}
        />
        <Controller
          name="chains"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="py-3">
                <div className="flex flex-row items-start justify-between">
                  <FieldLabel htmlFor={field.name}>Chains</FieldLabel>
                  <Combobox
                    multiple
                    autoHighlight
                    items={chains}
                    value={field.value as string[]}
                    onValueChange={(v) => field.onChange(v)}
                    defaultValue={["eth-mainnet"]}
                  >
                    <ComboboxChips ref={anchor} className="w-full max-w-xs">
                      <ComboboxValue>
                        {(values) => (
                          <>
                            {values.map((value: string) => {
                              const chain =
                                supportedChains[
                                  value as keyof typeof supportedChains
                                ];
                              return (
                                <ComboboxChip
                                  key={chain.key}
                                  className="flex flex-row items-center gap-1"
                                >
                                  {chain.name}
                                </ComboboxChip>
                              );
                            })}
                            <ComboboxChipsInput />
                          </>
                        )}
                      </ComboboxValue>
                    </ComboboxChips>
                    <ComboboxContent anchor={anchor}>
                      <ComboboxEmpty>No items found.</ComboboxEmpty>
                      <ComboboxList>
                        {(
                          group: { value: string; items: ChainWithMetadata[] },
                          index,
                        ) => (
                          <ComboboxGroup key={group.value} items={group.items}>
                            <ComboboxLabel>{group.value}</ComboboxLabel>
                            <ComboboxCollection>
                              {(item: ChainWithMetadata) => (
                                <ComboboxItem key={item.key} value={item.key}>
                                  {item.name}
                                </ComboboxItem>
                              )}
                            </ComboboxCollection>
                            {index < chains.length - 1 && <ComboboxSeparator />}
                          </ComboboxGroup>
                        )}
                        {/* {(item: ChainWithMetadata) => (
                          <ComboboxItem key={item.key} value={item.key}>
                            {item.name}
                          </ComboboxItem>
                        )} */}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>
                {isInvalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            );
          }}
        />
      </div>
      <div className="flex flex-row justify-end gap-2">
        <Button
          className="w-fit"
          type="button"
          variant="muted"
          render={<Link to="/dashboard/accounts" />}
        >
          Cancel
        </Button>
        <Button
          className="w-fit"
          type="submit"
          disabled={
            false
            // form.formState.isSubmitting || form.formState.isValid === false
          }
        >
          Create
        </Button>
      </div>
    </form>
  );
};

export * from "./create-button";
