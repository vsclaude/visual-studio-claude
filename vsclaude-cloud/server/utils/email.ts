import type { H3Event } from "nitro"
import { useRuntimeConfig } from "nitro/runtime-config"

import { logLine } from "./log.ts"

/**
 * Mail sent through Cloudflare Email Service's Workers binding — `EMAIL` in
 * `nitro.config.ts`. Two things have to be in place before anything leaves:
 * the sender's domain onboarded in the dashboard (Compute › Email Service ›
 * Email Sending, which writes its SPF, DKIM and DMARC records), and
 * `NITRO_EMAIL_FROM` naming an address on it. Either missing is `unsent`
 * rather than a throw, so a feature that mails somebody keeps working on a
 * deployment that has not set mail up.
 */

export type EmailAddress = { email: string; name?: string }

export type Email = {
  to: string | EmailAddress | (string | EmailAddress)[]
  subject: string
  /** At least one of the two; both is kinder to the clients that show text. */
  html?: string
  text?: string
  replyTo?: string | EmailAddress
}

/** The binding's own shape, as much of it as is used here. */
type SendEmail = {
  send(
    message: Email & { from: string | EmailAddress }
  ): Promise<{ messageId: string }>
}

export type EmailResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: "unconfigured" | "failed"; code?: string }

/**
 * `Vey Studio <hello@example.com>` as the binding's `{ email, name }`, or a
 * bare address as itself. Null for anything without an `@` in the address.
 */
export function senderOf(value: string): string | EmailAddress | null {
  const trimmed = value.trim()
  const named = /^(.*?)\s*<([^<>\s]+)>$/.exec(trimmed)
  if (named) {
    const [, name, email] = named
    if (!email!.includes("@")) return null
    const label = name!.replace(/^"(.*)"$/, "$1").trim()
    return label ? { email: email!, name: label } : email!
  }
  return /^[^\s<>]+@[^\s<>]+$/.test(trimmed) ? trimmed : null
}

/**
 * Sends one message from `NITRO_EMAIL_FROM`. Never throws: the binding's
 * errors carry a `code` (`E_SENDER_NOT_VERIFIED`, `E_RATE_LIMIT_EXCEEDED`, …)
 * that is logged and returned. The recipient is not logged — `log.ts` keeps
 * addresses out of a log more people read than the user table.
 */
export async function sendEmail(
  event: H3Event,
  email: Email
): Promise<EmailResult> {
  const from = senderOf(String(useRuntimeConfig().emailFrom ?? ""))
  const binding = (
    event.req as { runtime?: { cloudflare?: { env?: { EMAIL?: SendEmail } } } }
  ).runtime?.cloudflare?.env?.EMAIL
  if (!from || !binding) {
    logLine("email", { subject: email.subject, unsent: "unconfigured" })
    return { sent: false, reason: "unconfigured" }
  }
  try {
    const { messageId } = await binding.send({ ...email, from })
    logLine("email", { subject: email.subject, messageId })
    return { sent: true, messageId }
  } catch (error) {
    const code = codeOf(error)
    logLine("email", {
      subject: email.subject,
      failed: code ?? "unknown",
      message: error instanceof Error ? error.message : String(error),
    })
    return { sent: false, reason: "failed", code }
  }
}

/**
 * `sendEmail` after the response rather than before it — a sign-in page or a
 * webhook's answer should not wait on a mail, and a mail that fails is logged
 * by `sendEmail` with nothing for the request to do about it. Null, for a
 * user with no address, sends nothing.
 */
export function sendEmailLater(event: H3Event, email: Email | null): void {
  if (email) event.waitUntil(sendEmail(event, email))
}

function codeOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === "string" ? code : undefined
}
