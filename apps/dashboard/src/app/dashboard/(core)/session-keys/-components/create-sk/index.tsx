import { Link } from "@tanstack/react-router";

import { Schema } from "effect";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";

import { HeadingGroup } from "@/components/misc";
import { Button } from "@namera-ai/ui/components/ui/button";

import { Chains } from "./chains";
import { Metadata } from "./metadata";
import { NewSessionKeyFormSchema } from "./schema";

const handleSubmit = async (value: NewSessionKeyFormSchema) => {
  console.log(value);
};

export const NewSessionKeyForm = () => {
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
      <HeadingGroup
        heading="Create a new session key"
        description="Create a new Session Key across multiple chains with fine-grained permissions."
        size="lg"
        className="pb-0"
      />
      <Metadata form={form} />
      <Chains form={form} />
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
