### --profile

- **Type:** `string`
- **Default:** `personal`

Choose the saved CLI connection for this command. Pass the same name used at
login. If `NAMERA_API_KEY` is set, ordinary API commands use that key instead of
the profile's OAuth credentials.

```sh
namera wallet list --profile work
```
