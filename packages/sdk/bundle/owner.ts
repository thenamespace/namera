import { Grant, KernelAccount, Policy, Session, SessionKey } from "@namera-ai/sdk"

console.log(
  KernelAccount.from,
  Session.from,
  SessionKey.ecdsa,
  Policy.erc20Transfer,
  Policy.spend,
  Grant.create,
  Grant.serialize
)
