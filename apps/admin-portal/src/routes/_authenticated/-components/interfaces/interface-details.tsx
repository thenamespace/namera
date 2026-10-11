// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useMemo } from "react";

import { Link } from "@tanstack/react-router";

import type { ContractInterface } from "@namera-ai/protocol/model";
import { Button, CodeBlock, Typography } from "@namera-ai/ui";
import { ChainIcon, Copy01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { copyCatalogValue } from "../catalog/catalog-actions";
import { CatalogCopyValue, CatalogProperty } from "../catalog/catalog-property";

export function InterfaceDetails({ artifact }: { artifact: ContractInterface }) {
  const document = useMemo(() => JSON.stringify(artifact.document, null, 2), [artifact.document]);
  const functions = artifact.document.filter((entry) => entry.type === "function").length;
  const events = artifact.document.filter((entry) => entry.type === "event").length;
  const errors = artifact.document.filter((entry) => entry.type === "error").length;
  return (
    <div className="mx-auto w-full max-w-5xl py-4 sm:px-2 sm:py-8">
      <Link to="/interface" className="text-muted mb-6 inline-block text-sm hover:text-foreground">
        ← Interfaces
      </Link>
      <header>
        <ChainIcon namespace="eip155" chain="ethereum" className="size-10" aria-hidden="true" />
        <Typography.Heading level={2} className="mt-3 text-3xl tracking-tight">
          {artifact.data.name}
        </Typography.Heading>
        <p className="text-muted mt-2 text-sm">
          {functions} functions · {events} events · {errors} errors
        </p>
      </header>
      <section aria-labelledby="interface-properties" className="mt-10 max-w-3xl">
        <h3 id="interface-properties" className="text-muted mb-4 text-sm font-medium">
          Properties
        </h3>
        <dl className="grid gap-2">
          <CatalogProperty label="Format">EVM JSON ABI</CatalogProperty>
          <CatalogProperty label="Interface ID">
            <CatalogCopyValue value={artifact.id} label="Interface ID" />
          </CatalogProperty>
          <CatalogProperty label="Content hash">
            <CatalogCopyValue value={artifact.contentHash} label="Content hash" />
          </CatalogProperty>
          <CatalogProperty label="Source">
            <a
              href={artifact.sourceUrl.href}
              className="text-accent break-all underline"
              target="_blank"
              rel="noreferrer"
            >
              {artifact.sourceUrl.href}
            </a>
          </CatalogProperty>
        </dl>
      </section>
      <section aria-labelledby="interface-document" className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id="interface-document" className="text-sm font-medium">
            ABI document
          </h3>
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => {
              void copyCatalogValue(document, "ABI");
            }}
          >
            <HugeiconsIcon icon={Copy01Icon} />
            Copy JSON
          </Button>
        </div>
        <CodeBlock
          aria-label="ABI JSON"
          className="min-w-0 max-h-[36rem] overflow-auto rounded-xl border border-separator"
        >
          <CodeBlock.Code
            code={document}
            language="json"
            theme="github-dark-dimmed"
            darkTheme="github-dark-dimmed"
            className="text-xs"
          />
        </CodeBlock>
      </section>
    </div>
  );
}
