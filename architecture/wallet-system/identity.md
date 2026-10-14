# ENS identities and profile images

Namera identities are offchain `namera.id` subnames managed through Namespace.
Their owner is the account address. Identity records are read from the provider;
Namera does not keep a separate identity table.

## Name and record management

Application resolves the organization-scoped active account, then verifies every
returned name's parent, full name and owner. An upstream owner filter is not an
authorization boundary.

Creation locks the wallet, checks name availability and scans owned names to
enforce one identity per account. It creates Ethereum and default address records.
A repeat request for the same owned name returns that identity. The remote write
cannot be rolled back by a database transaction; its audit records the observed
change.

Record updates validate the complete batch before writing. Changes are applied
sequentially. A later provider failure returns `PARTIAL_UPDATE` with the number
applied and records that partial change; it does not imply rollback.

## Ethereum primary name

Setting a primary name is an Ethereum transaction, distinct from changing an
offchain profile. The EVM identity adapter resolves the reverse registrar and
constructs `setName(string)`. The dashboard submits it through the generic
owner [transaction flow](transactions.md), with independent review of the target,
calldata and prepared envelope.

The status query combines ENS forward/reverse resolution with the latest matching
wallet operation. Pending approval and confirmation therefore survive page reload.
The UI can cancel unsigned preparation; pending chain operations are reconciled.

## Avatar and header uploads

The browser accepts PNG, JPEG, WebP or GIF up to 2 MB each and shows local previews.
It does not crop or compress files. Save opens the shared review dialog.

For each changed image, the browser obtains a scoped nonce from avtr.cc's metadata
service at `metadata.namespace.ninja`, constructs a SIWE authorization and uses
the owner signature endpoints. It verifies the returned account, operation,
payload and expiry before uploading multipart data directly to the service.
Returned HTTPS image URLs are saved as identity text records.

Avatar and header are processed serially with separate authorizations. An uploaded
URL is retained in the current draft if record persistence fails, so retry can
save the record without uploading again. Completed fields clear independently.
Aborting the browser flow does not undo a remote upload that already completed.

## Code

- [Names and records](../../packages/application/src/ens/identities.ts)
- [Primary status](../../packages/application/src/ens/primary.ts)
- [Registrar and call](../../packages/evm/src/identity/service.ts)
- [Browser upload protocol](../../apps/dashboard/src/routes/_authenticated/identity/-components/namespace-artwork.ts)
- [Upload orchestration](../../apps/dashboard/src/routes/_authenticated/identity/-components/artwork-upload.ts)
