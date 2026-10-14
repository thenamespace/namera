---
"@namera-ai/api": minor
"@namera-ai/protocol": minor
"@namera-ai/cli": patch
---

Add actor-scoped cancellation endpoints for unsigned wallet transactions, session-key approvals, and delegated execution preparations. Cancellation releases applicable reservations atomically, rejects signed or pending transactions and active signing leases, and exposes a terminal cancelled status.
