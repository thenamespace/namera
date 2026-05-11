import { Link } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Controller, useForm } from "react-hook-form";
import { useConnectionEffect } from "wagmi";

import { createSmartAccount } from "@/actions/core";
import { ConnectButton } from "@/components";
import { CreateSmartAccountRequest } from "@namera-ai/schema";
import { Button } from "@namera-ai/ui/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@namera-ai/ui/components/ui/field";
import { IconPicker } from "@namera-ai/ui/components/ui/icon-picker";
import { Input } from "@namera-ai/ui/components/ui/input";

export const NewAccountForm = () => {
  const form = useForm<CreateSmartAccountRequest>({
    defaultValues: {
      metadata: {
        icon: {
          type: "icon",
          value: "wallet",
        },
        name: "",
      },
    },
    resolver: standardSchemaResolver(
      Schema.toStandardSchemaV1(CreateSmartAccountRequest),
    ),
  });

  const handleSubmit = async (value: CreateSmartAccountRequest) => {
    const res = await createSmartAccount(value);
    console.log(res);
  };

  useConnectionEffect({
    onConnect: ({ address }) => {
      console.log("onConnect", address);
      form.setValue("owner", address);
    },
    onDisconnect: () => {
      console.log("onDisconnect");
      form.setValue("owner", "0x0");
    },
  });

  return (
    <form
      className="flex w-full flex-col gap-4"
      id="new-account-form"
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <div className="flex flex-col gap-2 px-1 py-4">
        <div className="text-2xl font-medium">Create a new account</div>
        <p className="text-muted-foreground text-sm">
          Create a new Smart Account with Multichain ECDSA Validator
        </p>
      </div>
      <div className="bg-card flex flex-col gap-2 divide-y rounded-2xl border px-5">
        <Controller
          name="metadata.icon"
          control={form.control}
          render={({ field, fieldState }) => {
            const isInvalid = fieldState.invalid;
            return (
              <Field data-invalid={isInvalid} className="flex flex-row py-3">
                <FieldLabel htmlFor={field.name}>Account Icon</FieldLabel>
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
