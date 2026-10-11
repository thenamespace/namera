### --type

- **Type:** `message | typed-data`
- **Required:** for non-interactive input flags

Choose a UTF-8 message or an EIP-712 structured payload. There is no default.

### --message

- **Type:** `string`
- **Required:** when `--type message`

The exact UTF-8 message. Quote it to preserve spaces. Whitespace and letter case
are part of the signed payload. Do not combine this with `--typed-data`.

### --typed-data

- **Type:** JSON string
- **Required:** when `--type typed-data`

Supply `domain`, `types`, `primaryType`, and `message` following EIP-712.
The domain identifies the application and can bind the signature to a chain and
verifying contract. Use the same full object when verifying. Do not combine it
with `--message`.
