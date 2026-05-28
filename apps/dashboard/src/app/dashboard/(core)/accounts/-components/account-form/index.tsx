import { Link } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";
import { useConnectionEffect } from "wagmi";

import { HeadingGroup } from "@/components/misc";
import { Button } from "@namera-ai/ui/components/ui/button";

import { EnsDetails } from "./ens";
import { Metadata } from "./metadata";

const handleSubmit = (value: CreateSmartAccountRequest) => {
  console.log(value);
};

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
      <HeadingGroup
        heading="Create a new account"
        description="Create a new Smart Account with Multichain ECDSA Validator"
        size="lg"
      />

      <Metadata form={form} />
      <EnsDetails form={form} />
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
