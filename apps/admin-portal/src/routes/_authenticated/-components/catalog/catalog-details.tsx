import { Link } from "@tanstack/react-router";

import { Avatar, Typography } from "@namera-ai/ui";

import { InviteDate } from "../invites/invite-display";
import { CatalogDeployments } from "./catalog-deployments";
import { CatalogStatus, type CatalogRecord } from "./catalog-display";
import { CatalogCopyValue, CatalogProperty } from "./catalog-property";

export function CatalogDetails({ record }: { record: CatalogRecord }) {
  const { display } = record.data;
  return (
    <div className="mx-auto w-full max-w-5xl py-4 sm:px-2 sm:py-8">
      <Link to="/catalog" className="text-muted mb-6 inline-block text-sm hover:text-foreground">
        ← Address Catalog
      </Link>
      <header className="flex flex-col items-start">
        <Avatar size="lg">
          <Avatar.Image src={`https://cdn.namera.ai/${display.logo}`} alt="" />
          <Avatar.Fallback>{display.name.slice(0, 2)}</Avatar.Fallback>
        </Avatar>
        <Typography.Heading level={2} className="mt-3 text-3xl tracking-tight">
          {display.name}
        </Typography.Heading>
        {display.description ? (
          <p className="text-muted mt-2 max-w-2xl text-sm">{display.description}</p>
        ) : null}
      </header>
      <section aria-labelledby="catalog-properties" className="mt-10 max-w-3xl">
        <h3 id="catalog-properties" className="text-muted mb-4 text-sm font-medium">
          Properties
        </h3>
        <dl className="grid gap-2">
          <CatalogProperty label="Status">
            <CatalogStatus status={record.status} />
          </CatalogProperty>
          <CatalogProperty label="Type">
            {record.data.type === "erc20" ? "ERC-20 token" : "Contract"}
          </CatalogProperty>
          <CatalogProperty label="Namespace">Ethereum / EVM · eip155</CatalogProperty>
          {record.data.type === "erc20" ? (
            <CatalogProperty label="Symbol">{record.data.details.symbol}</CatalogProperty>
          ) : (
            <>
              {record.data.details.protocol ? (
                <CatalogProperty label="Protocol">{record.data.details.protocol}</CatalogProperty>
              ) : null}
              {record.data.details.contractVersion ? (
                <CatalogProperty label="Contract version">
                  {record.data.details.contractVersion}
                </CatalogProperty>
              ) : null}
            </>
          )}
          <CatalogProperty label="Slug">{record.slug}</CatalogProperty>
          <CatalogProperty label="Catalog ID">
            <CatalogCopyValue value={record.id} label="Catalog ID" />
          </CatalogProperty>
          {display.website ? (
            <CatalogProperty label="Website">
              <a
                className="text-accent break-all underline"
                href={display.website.href}
                target="_blank"
                rel="noreferrer"
              >
                {display.website.hostname}
              </a>
            </CatalogProperty>
          ) : null}
          {display.aliases.length ? (
            <CatalogProperty label="Aliases">{display.aliases.join(", ")}</CatalogProperty>
          ) : null}
          {display.tags.length ? (
            <CatalogProperty label="Tags">
              <div className="flex flex-wrap gap-1.5">
                {display.tags.map((tag) => (
                  <span key={tag} className="bg-default rounded-md px-2 py-0.5 text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </CatalogProperty>
          ) : null}
          <CatalogProperty label="Search terms">{record.search.join(", ")}</CatalogProperty>
          <CatalogProperty label="Revision">{record.revision}</CatalogProperty>
          <CatalogProperty label="Created">
            <InviteDate label="Created" value={record.createdAt} />
          </CatalogProperty>
          <CatalogProperty label="Updated">
            <InviteDate label="Updated" value={record.updatedAt} />
          </CatalogProperty>
        </dl>
      </section>
      <CatalogDeployments entries={record.entries} />
    </div>
  );
}
