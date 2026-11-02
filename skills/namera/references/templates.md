# Templates

Follow the [overview](https://namera.ai/docs/sdk/guides/templates.md) for installation,
discovery and a complete SDK example. A template builds permissions locally; pass
the output to the existing session-creation method, then
[approve installation](https://namera.ai/docs/sdk/guides/accounts/install-session-keys.md).

For USDC spending, read [USDC Spend Template](https://namera.ai/docs/sdk/guides/templates/usdc-allowance.md)
for inputs, supported networks and generated permissions. Each selected network
receives the full lifetime allowance; the budget is not shared across networks.
Gas sponsorship is separate.

For a custom builder, follow [Create a Custom Template](https://namera.ai/docs/sdk/guides/templates/create-custom-template.md)
and [Test a Custom Template](https://namera.ai/docs/sdk/guides/templates/test-custom-template.md).
Custom definitions stay in the application or its package. They do not add entries
to the hosted dashboard or change sessions already created.
