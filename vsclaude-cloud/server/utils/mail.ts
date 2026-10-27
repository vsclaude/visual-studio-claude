import type { Email } from "./email.ts"
import { html, type SafeHtml } from "./html.ts"
import type { User } from "./session.ts"
import { formatCredits } from "./usage.ts"

/**
 * The two mails this server sends, as `sendEmail` takes them: a welcome on a
 * user's first sign-in (`/signin/callback`) and a thank-you when a purchase
 * adds credits (the SePay and Paddle webhooks). In Vietnamese — the packs are
 * priced in đồng and most of the people buying them pay by Vietnamese bank
 * transfer. Pure, so `test/mail.test.ts` reads them without a Worker.
 *
 * `origin` is this server's own address (`publicUrlOf`): the logo is
 * `/email-logo.png` under it, a PNG rendered from `resources/logo.svg`,
 * because Gmail and Outlook draw no SVG and a `data:` image is blocked by
 * most clients.
 */

/** The welcome mail, or null for a user Google gave no email for. */
export function welcomeEmail(user: User, origin: string): Email | null {
  if (!user.email) return null
  const greeting = greetingOf(user.name)
  return {
    to: user.email,
    subject: "Chào mừng bạn đến với Vey Studio",
    text: [
      `${greeting},`,
      "",
      "Bạn đã đăng nhập Vey Studio thành công. Từ giờ bạn có thể dùng AI miễn phí của Vey Studio ngay trong ứng dụng, trong hạn mức mỗi ngày — và nạp thêm credits khi cần dùng nhiều hơn.",
      "",
      "Nếu không phải bạn vừa đăng nhập, hãy trả lời email này để chúng tôi hỗ trợ.",
      "",
      "— Vey Studio",
    ].join("\n"),
    html: layout({
      origin,
      preview: "Bạn đã đăng nhập Vey Studio thành công.",
      title: "Chào mừng bạn đến với Vey Studio",
      body: html`
        ${paragraph(html`${greeting},`)}
        ${paragraph(
          html`Bạn đã đăng nhập Vey Studio thành công. Từ giờ bạn có thể dùng
            <strong>AI miễn phí</strong> của Vey Studio ngay trong ứng dụng,
            trong hạn mức mỗi ngày — và nạp thêm credits khi cần dùng nhiều hơn.`
        )}
        ${note(
          "Nếu không phải bạn vừa đăng nhập, hãy trả lời email này để chúng tôi hỗ trợ."
        )}
      `,
    }),
  }
}

export type Payment = {
  /** Credits added, in `usage.ts`'s units. */
  credits: number
  /** What was charged, in the currency's smallest unit — Paddle's way; a
   * bank transfer's đồng are already that. Null when it is not known. */
  amount: number | null
  currency: string | null
  /** What the buyer can quote back: a bank transfer's order code
   * (`VSC12345678`), or Paddle's transaction id (`txn_…`), which is also on
   * Paddle's own receipt. */
  order: string
}

/** The thank-you for a purchase, or null for a user with no email. */
export function paymentEmail(
  user: User,
  payment: Payment,
  origin: string
): Email | null {
  if (!user.email) return null
  const greeting = greetingOf(user.name)
  const credits = formatCredits(payment.credits)
  const paid = moneyOf(payment.amount, payment.currency)
  const line = paid
    ? `Chúng tôi đã nhận ${paid} và cộng ${credits} credits vào tài khoản của bạn.`
    : `Chúng tôi đã cộng ${credits} credits vào tài khoản của bạn.`
  return {
    to: user.email,
    subject: "Cảm ơn bạn đã nạp credits Vey Studio",
    text: [
      `${greeting},`,
      "",
      `Cảm ơn bạn đã ủng hộ Vey Studio! ${line} Số dư mới đã có hiệu lực trong ứng dụng.`,
      "",
      `Mã đơn hàng: ${payment.order}`,
      "",
      "Nếu có gì chưa đúng, hãy trả lời email này kèm mã đơn hàng.",
      "",
      "— Vey Studio",
    ].join("\n"),
    html: layout({
      origin,
      preview: `Đã cộng ${credits} credits vào tài khoản của bạn.`,
      title: "Cảm ơn bạn đã nạp credits",
      body: html`
        ${paragraph(html`${greeting},`)}
        ${paragraph(
          "Cảm ơn bạn đã ủng hộ Vey Studio! Giao dịch của bạn đã hoàn tất và số dư mới đã có hiệu lực trong ứng dụng."
        )}
        ${summary([
          ["Mã đơn hàng", payment.order],
          ...(paid ? [["Số tiền đã thanh toán", paid] as const] : []),
          ["Credits đã cộng", credits],
        ])}
        ${note("Nếu có gì chưa đúng, hãy trả lời email này kèm mã đơn hàng.")}
      `,
    }),
  }
}

function greetingOf(name: string | null): string {
  const trimmed = name?.trim()
  return trimmed ? `Chào ${trimmed}` : "Chào bạn"
}

/** `50.000 ₫`, `25,00 US$` — from the smallest unit, by the currency's own
 * number of decimals. Null for an amount or currency not known. */
export function moneyOf(
  amount: number | null,
  currency: string | null
): string | null {
  if (amount === null || !Number.isFinite(amount) || !currency) return null
  try {
    const format = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: currency.toUpperCase(),
    })
    const decimals = format.resolvedOptions().maximumFractionDigits ?? 0
    return format.format(amount / 10 ** decimals)
  } catch {
    return null
  }
}

/*
 * The markup is the email kind, not the web kind: tables for layout and
 * styles inline on each element, since Gmail drops most of a `<style>` block
 * and Outlook lays out with Word. The plate's violet-to-amber gradient is the
 * logo's; the bar under the header falls back to its violet where a client
 * draws no gradient.
 */

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"
const INK = "#1f1f23"
const MUTED = "#6b6b76"
const VIOLET = "#8B5CF6"

function paragraph(content: SafeHtml | string): SafeHtml {
  return html`<p
    style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${INK}"
  >
    ${content}
  </p>`
}

/** The small print under the body. */
function note(content: string): SafeHtml {
  return html`<p
    style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${MUTED}"
  >
    ${content}
  </p>`
}

/** Label-and-value rows in a tinted box — a purchase's receipt. */
function summary(rows: readonly (readonly [string, string])[]): SafeHtml {
  return html`<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    style="margin:8px 0 8px;background:#f7f5ff;border:1px solid #ebe5ff;border-radius:10px"
  >
    ${rows.map(
      ([label, value], index) =>
        html`<tr>
          <td
            style="padding:14px 18px;font-size:14px;color:${MUTED};${
              index > 0 ? "border-top:1px solid #ebe5ff;" : ""
            }"
          >
            ${label}
          </td>
          <td
            align="right"
            style="padding:14px 18px;font-size:15px;font-weight:600;color:${INK};${
              index > 0 ? "border-top:1px solid #ebe5ff;" : ""
            }"
          >
            ${value}
          </td>
        </tr>`
    )}
  </table>`
}

function layout(input: {
  origin: string
  /** The line an inbox shows after the subject, hidden in the mail itself. */
  preview: string
  title: string
  body: SafeHtml
}): string {
  const origin = input.origin.replace(/\/+$/, "")
  return html`<!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <title>${input.title}</title>
      </head>
      <body
        style="margin:0;padding:0;background:#f4f3f8;font-family:${FONT};-webkit-font-smoothing:antialiased"
      >
        <div
          style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent"
        >
          ${input.preview}
        </div>
        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          style="background:#f4f3f8"
        >
          <tr>
            <td align="center" style="padding:40px 16px">
              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                style="max-width:560px"
              >
                <tr>
                  <td align="center" style="padding:0 0 24px">
                    <img
                      src="${origin}/email-logo.png"
                      width="56"
                      height="56"
                      alt="Vey Studio"
                      style="display:block;border:0;width:56px;height:56px;border-radius:13px"
                    />
                  </td>
                </tr>
                <tr>
                  <td
                    style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(31,31,35,0.06)"
                  >
                    <div
                      style="height:4px;line-height:4px;font-size:0;background:${VIOLET};background-image:linear-gradient(90deg,#6D28D9,#8B5CF6,#C76BC4,#F0956A,#FCC63A)"
                    >
                      &nbsp;
                    </div>
                    <div style="padding:36px 36px 32px">
                      <h1
                        style="margin:0 0 24px;font-size:22px;line-height:1.3;font-weight:700;color:${INK}"
                      >
                        ${input.title}
                      </h1>
                      ${input.body}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td
                    align="center"
                    style="padding:24px 16px 0;font-size:12px;line-height:1.6;color:${MUTED}"
                  >
                    <a
                      href="${origin}"
                      style="color:${MUTED};text-decoration:none;font-weight:600"
                      >Vey Studio</a
                    >
                    · Chạy nhiều cuộc trò chuyện Claude cùng lúc
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>`.value
}
