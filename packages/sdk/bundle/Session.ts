import { Policy, Session, SessionKey } from "@namera-ai/sdk"

const session = Session.from({
  signer: SessionKey.ecdsa("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
  validUntil: Session.expiresIn({ days: 7 }),
  policies: [
    Policy.erc20Transfer({ token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount: { lte: 50_000000n } }),
    Policy.spend({ token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount: 200_000000n, period: "day" })
  ]
})

console.log(Session.validate(session), Session.describe(session), Session.toSmartSession(session))
