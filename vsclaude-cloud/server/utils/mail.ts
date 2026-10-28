import type { Email } from "./email.ts"
import { html, type SafeHtml } from "./html.ts"

/**
 * The one mail this server sends, as `sendEmail` takes it: the Vey Pro
 * licence key when its transfer lands (the SePay webhook). The welcome on a
 * first sign-in went with the sign-in. In Vietnamese — Pro is priced in đồng
 * and paid by Vietnamese bank transfer. Pure, so `test/mail.test.ts` reads them without a Worker.
 *
 * `origin` is this server's own address (`publicUrlOf`): the logo is
 * `/email-logo.png` under it, a PNG rendered from `resources/logo.svg`,
 * because Gmail and Outlook draw no SVG and a `data:` image is blocked by
 * most clients.
 */

/**
 * The licence key, after its transfer lands. The key **is** the content now:
 * there is no sign-in to carry Pro to another machine, so this mail is where
 * the buyer finds what to paste there — the device they bought on is already
 * on it. Says how many devices the key is for, and the refund window.
 */
export function proEmail(
  purchase: {
    to: string
    key: string
    seats: number
    amount: number
    order: string
  },
  origin: string
): Email {
  const paid = moneyOf(purchase.amount, "VND")
  const devices = `${purchase.seats} thiết bị`
  return {
    to: purchase.to,
    subject: "Khoá licence Vey Pro của bạn",
    text: [
      "Chào bạn,",
      "",
      `Cảm ơn bạn đã mua Vey Pro cho ${devices}! ${paid ? `Chúng tôi đã nhận ${paid}. ` : ""}Pro đã được bật trên máy bạn vừa mua.`,
      "",
      "Khoá licence của bạn:",
      "",
      `    ${purchase.key}`,
      "",
      `Khoá dùng được trên ${devices} cùng lúc. Trên máy khác, mở Vey Studio, bấm Upgrade ở góc trên bên phải, chọn "Đã có khoá?" và dán khoá vào. Muốn chuyển sang máy mới, huỷ kích hoạt trên máy cũ trong cùng hộp thoại đó.`,
      "",
      `Mã đơn hàng: ${purchase.order}`,
      "",
      "Hoàn tiền trong 7 ngày: trả lời email này kèm mã đơn hàng.",
      "",
      "— Vey Studio",
    ].join("\n"),
    html: layout({
      origin,
      preview: `Khoá Vey Pro cho ${devices}: ${purchase.key}`,
      title: "Cảm ơn bạn đã mua Vey Pro",
      body: html`
        ${paragraph("Chào bạn,")}
        ${paragraph(
          `Cảm ơn bạn đã mua Vey Pro cho ${devices}! Pro đã được bật trên máy bạn vừa mua. Đây là khoá licence để kích hoạt trên các máy còn lại:`
        )}
        ${keyBlock(purchase.key)}
        ${paragraph(
          `Khoá dùng được trên ${devices} cùng lúc. Trên máy khác, mở Vey Studio, bấm Upgrade ở góc trên bên phải, chọn "Đã có khoá?" và dán khoá vào. Muốn chuyển sang máy mới, huỷ kích hoạt trên máy cũ trong cùng hộp thoại đó.`
        )}
        ${summary([
          ["Mã đơn hàng", purchase.order],
          ...(paid ? [["Số tiền đã thanh toán", paid] as const] : []),
          ["Số thiết bị", devices],
        ])}
        ${note("Hoàn tiền trong 7 ngày: trả lời email này kèm mã đơn hàng.")}
      `,
    }),
  }
}

/** The key, set apart in a monospace box so it can be selected whole. */
function keyBlock(key: string): SafeHtml {
  return html`<p
    style="margin:0 0 20px;padding:14px 16px;border-radius:10px;background:#f4f2fb;border:1px solid #e2ddf5;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:17px;font-weight:600;letter-spacing:0.06em;color:#2b2540;text-align:center"
  >
    ${key}
  </p>`
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
