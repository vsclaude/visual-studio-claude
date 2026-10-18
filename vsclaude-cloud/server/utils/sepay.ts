import type { H3Event } from "nitro"
import { useRuntimeConfig } from "nitro/runtime-config"

/**
 * This server's SePay: the bank account transfers go to, the order codes'
 * prefix, and the webhook's key.
 *
 * SePay itself holds no money and creates no orders — it watches the account
 * and reports what arrives — so the account is configuration here, and the QR
 * is drawn from it (`qrUrl`).
 */
export function sepayConfig() {
  const config = useRuntimeConfig()
  return {
    /** The account number, as the banking app needs it for the QR. */
    account: String(config.sepayBankAccount),
    /** SePay's short bank code (`qr.sepay.vn/banks.json`), e.g. `MBBank`. */
    bank: String(config.sepayBankCode),
    /** The account holder's name, shown beside the QR so the buyer can check
     * whom they are paying. */
    accountName: String(config.sepayAccountName),
    prefix: String(config.sepayCodePrefix).toUpperCase(),
    webhookSecret: String(config.sepayWebhookSecret),
    apiKey: String(config.sepayApiKey),
  }
}

/** Whether bank transfers can be sold at all: an account to pay into, and a
 * way to know a webhook is SePay's. */
export function sepayReady(): boolean {
  const sepay = sepayConfig()
  return Boolean(
    sepay.account && sepay.bank && (sepay.webhookSecret || sepay.apiKey)
  )
}

/**
 * The address a page of this server is at, for a link the studio opens:
 * `NITRO_PUBLIC_URL` when the server sits behind a proxy that changes its
 * origin, otherwise the origin the request came in on.
 */
export function publicUrlOf(event: H3Event): string {
  const configured = String(useRuntimeConfig().publicUrl).replace(/\/+$/, "")
  return configured || event.url.origin
}
