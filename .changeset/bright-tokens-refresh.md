---
"@namera-ai/protocol": minor
"@namera-ai/api": minor
"@namera-ai/sdk": minor
---

Replace legacy address enrichment with Alchemy portfolios. Remove address-metadata endpoints and models, add exact per-asset USD values, and support explicit portfolio refresh with five-minute account caching. Clients must stop reading `addressMetadata` and use asset metadata instead.
