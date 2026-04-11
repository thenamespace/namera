import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { TriangleIcon } from "@phosphor-icons/react";
import { Controller, useForm } from "react-hook-form";
import { useConnectionEffect } from "wagmi";

import { ConnectButton } from "@/components";
import { EthereumAddress } from "@namera-ai/schema";
import { Button } from "@namera-ai/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@namera-ai/ui/components/ui/collapsible";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@namera-ai/ui/components/ui/field";
import { IconPicker } from "@namera-ai/ui/components/ui/icon-picker";
import { Input } from "@namera-ai/ui/components/ui/input";

const NewAccount = Schema.toStandardSchemaV1(
  Schema.Struct({
    metadata: Schema.Struct({
      icon: Schema.Struct({
        type: Schema.Literals(["icon", "emoji"]),
        value: Schema.String,
      }),
      name: Schema.String.check(
        Schema.isLengthBetween(4, 255, {
          message: "Name must be between 4 and 255 characters long",
        }),
      ),
    }),
    ownerAddress: EthereumAddress,
    index: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  }),
);

type NewAccount = typeof NewAccount.Type;
type NewAccountEncoded = typeof NewAccount.Encoded;

export const NewAccountForm = () => {
  const form = useForm<NewAccount, NewAccountEncoded>({
    defaultValues: {
      metadata: {
        icon: {
          type: "icon",
          value: "wallet",
        },
        name: "",
      },
    },
    resolver: standardSchemaResolver(Schema.toStandardSchemaV1(NewAccount)),
  });

  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const handleSubmit = (value: NewAccount) => {
    console.log("submitting...", value);
  };

  useConnectionEffect({
    onConnect: ({ address }) => {
      console.log("onConnect", address);
      form.setValue("ownerAddress", address);
    },
    onDisconnect: () => {
      console.log("onDisconnect");
      form.setValue("ownerAddress", "0x0");
    },
  });

  return (
    <form
      className="flex w-full flex-col gap-4"
      id="new-account-form"
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <div className="flex flex-col gap-2 px-1">
        <div className="text-2xl">Create a new account</div>
        <p className="text-muted-foreground text-sm">
          Create a new Smart Account with Multichain ECDSA Validator
        </p>
      </div>
      <div className="bg-card flex flex-col divide-y rounded-xl border-[0.5px] px-4">
        <Controller
          name="metadata.icon"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="flex flex-row py-3">
                <div className="flex flex-col">
                  <FieldLabel htmlFor={field.name}>Account Icon</FieldLabel>
                  <div className="text-muted-foreground text-xs">
                    Recommended size is 256x256px
                  </div>
                </div>
                <IconPicker
                  value={field.value}
                  onChange={(icon) => field.onChange(icon)}
                />
                {isInvalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            );
          }}
        />
        <div className="flex flex-row items-center justify-between gap-2 py-4">
          <FieldLabel htmlFor="ownerAddress">Account Owner</FieldLabel>
          <ConnectButton />
        </div>
        <Controller
          name="metadata.name"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="py-3">
                <div className="flex flex-row items-center justify-between">
                  <FieldLabel htmlFor={field.name}>Account Name</FieldLabel>
                  <Input
                    className="max-w-48"
                    id={field.name}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                    aria-invalid={isInvalid}
                    placeholder="eg. My Account"
                    autoComplete="off"
                  />
                </div>
                {isInvalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            );
          }}
        />
      </div>
      <Collapsible className="flex w-full flex-col gap-1" defaultOpen={false}>
        <CollapsibleTrigger
          className="group"
          nativeButton={false}
          render={
            <div className="text-muted-foreground flex h-5 cursor-pointer flex-row items-center gap-1.5 text-xs select-none" />
          }
        >
          Advanced
          <TriangleIcon
            className="size-2! rotate-90 transition-all group-data-panel-open:rotate-180"
            weight="fill"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex h-(--collapsible-panel-height) flex-col justify-end overflow-hidden text-sm transition-all duration-150 ease-out data-ending-style:h-0 data-starting-style:h-0 [&[hidden]:not([hidden='until-found'])]:hidden">
          <div className="bg-card flex flex-col divide-y rounded-xl border-[0.5px] px-4">
            <Controller
              control={form.control}
              name="index"
              render={({ field, fieldState }) => {
                const isInvalid = fieldState.invalid;
                return (
                  <Field
                    data-invalid={isInvalid}
                    className="flex flex-row py-3"
                  >
                    <FieldLabel htmlFor={field.name}>Account Index</FieldLabel>
                    <Input
                      id={field.name}
                      {...field}
                      className="max-w-48"
                      type="number"
                      min={0}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      aria-invalid={isInvalid}
                      placeholder="eg. 1"
                      autoComplete="off"
                    />
                    {isInvalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                );
              }}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
      <div className="flex justify-end">
        <Button className="cta-button w-fit" type="submit">
          Create Account
        </Button>
      </div>
    </form>
  );
};
