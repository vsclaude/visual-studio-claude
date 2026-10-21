import { defineHandler } from "nitro"

import { getOrder } from "../../utils/accounts.ts"
import { arrivalCard, arrivalScript } from "../../utils/arrival-page.ts"
import { CREDIT_PACKS, isCreditItem } from "../../utils/billing.ts"
import {
  html,
  htmlResponse,
  json,
  raw,
  type SafeHtml,
} from "../../utils/html.ts"
import { paymentDocument } from "../../utils/payment-page.ts"
import { qrUrl } from "../../utils/sepay-billing.ts"
import { sepayConfig } from "../../utils/sepay.ts"
import { formatCredits } from "../../utils/usage.ts"

/**
 * `GET /pay/<code>` — the page a bank-transfer purchase opens in the browser:
 * the VietQR to scan, and the account, amount and content written out for
 * somebody typing them in by hand. It asks `GET /api/orders/<code>` every few
 * seconds and says so once the transfer has arrived — with the card of credits
 * it added, on this page.
 *
 * In Vietnamese: it is the page for people paying from a Vietnamese bank.
 */

function itemName(item: string): string {
  if (!isCreditItem(item)) return "Đơn hàng"
  return `Gói credit ${formatCredits(CREDIT_PACKS[item].credits)}`
}

/**
 * One line of the transfer's details. `copy` is what the button puts on the
 * clipboard, which is not always what is shown: the amount is copied as bare
 * digits, since a bank app's amount field rejects "500.000".
 */
function row(
  label: string,
  shown: string,
  copy: string | null,
  className = ""
): SafeHtml {
  return html`<div class="${className ? `row ${className}` : "row"}">
    <dt>${label}</dt>
    <dd>
      <span class="value">${shown}</span>${
        copy !== null &&
        html`<button type="button" class="copy" data-copy="${copy}">
          Sao chép
        </button>`
      }
    </dd>
  </div>`
}

const PAY_CSS = `
  .pay-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .price { margin: 0; text-align: right; }
  .price strong { display: block; font-size: 1.6rem; font-weight: 500; letter-spacing: -0.03em; line-height: 1.2;
    color: transparent; background: linear-gradient(90deg, #a78bfa, #fbbf24); -webkit-background-clip: text; background-clip: text; }
  .price span { color: var(--faint); font-size: 0.78rem; }
  .grid { display: grid; grid-template-columns: auto 1fr; gap: 1.5rem; align-items: start; margin-top: 1.5rem; }
  .qr-box { margin: 0; padding: 10px; border-radius: 14px; background: #fff; line-height: 0;
    box-shadow: 0 0 0 1px var(--edge-strong), 0 18px 40px rgb(124 92 246 / 0.18); }
  .qr-box img { width: 220px; height: 220px; display: block; }
  .rows { margin: 0; border: 1px solid var(--edge); border-radius: 12px; overflow: hidden; }
  .row { display: grid; grid-template-columns: 7.5rem 1fr; align-items: center; gap: 0.75rem; padding: 0.6rem 0.85rem; }
  .row + .row { border-top: 1px solid var(--edge); }
  .row dt { color: var(--muted); font-size: 0.84rem; }
  .row dd { margin: 0; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; min-width: 0; }
  /* break-word, not anywhere: an account number or a code split over two
     lines is one somebody types back in wrong. */
  .row .value { min-width: 0; overflow-wrap: break-word; font-weight: 500; }
  .row.key { background: rgb(139 92 246 / 0.08); }
  .row.key .value { color: var(--accent-soft); font-family: var(--mono); letter-spacing: 0.06em; }
  .copy { flex: none; padding: 0.25rem 0.6rem; border-radius: 6px; border: 1px solid var(--edge-strong);
    background: rgb(255 255 255 / 0.03); color: var(--body); font: inherit; font-size: 0.74rem; cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s; }
  .copy:hover { background: rgb(255 255 255 / 0.08); color: var(--ink); }
  .copy.copied { border-color: rgb(134 239 172 / 0.35); color: var(--ok); }
  .hint { margin: 0.85rem 0 0; color: var(--muted); font-size: 0.82rem; }
  .hint b { color: var(--accent-soft); font-family: var(--mono); font-weight: 500; }
  @media (max-width: 640px) {
    main { padding-top: 1.75rem; }
    .panel { padding: 1.25rem; }
    .price { text-align: left; }
    .grid { grid-template-columns: 1fr; }
    .qr-box { justify-self: center; }
    .row { grid-template-columns: 5.75rem 1fr; gap: 0.5rem; padding-inline: 0.75rem; }
    .row.key .value { letter-spacing: 0; white-space: nowrap; }
  }`

export default defineHandler(async (event) => {
  const code = String(event.context.params?.code ?? "").toUpperCase()
  const order = await getOrder(code)
  const sepay = sepayConfig()
  const page = (main: SafeHtml, scripts?: SafeHtml) =>
    htmlResponse(
      paymentDocument({
        lang: "vi",
        title: "Thanh toán — VS Claude",
        secure: "Chuyển khoản ngân hàng",
        css: PAY_CSS,
        main,
        foot: "Thanh toán qua VietQR · xác nhận tự động bởi SePay",
        scripts,
      }),
      order ? 200 : 404
    )

  if (!order) {
    return page(
      html`<section class="panel">
        <p class="kicker">${code || "—"}</p>
        <h1>Không tìm thấy đơn hàng</h1>
        <p class="lede">Hãy bắt đầu lại từ menu tài khoản trong VS Claude.</p>
      </section>`
    )
  }

  const paid = order.paidBy !== null
  const amount = new Intl.NumberFormat("vi-VN").format(order.amount)
  const qr = qrUrl({
    account: sepay.account,
    bank: sepay.bank,
    amount: order.amount,
    code: order.code,
  })
  return page(
    html`<section class="panel">
        <div class="pay-head">
          <div>
            <p class="kicker">Đơn hàng ${order.code}</p>
            <h1>${itemName(order.item)}</h1>
            <p class="lede">
              Quét mã bằng app ngân hàng — số tiền và nội dung đã điền sẵn.
            </p>
          </div>
          <p class="price">
            <strong>${amount} ₫</strong
            ><span>Credits không bao giờ hết hạn</span>
          </p>
        </div>
        <div class="grid">
          <figure class="qr-box">
            <img src="${qr}" alt="Mã VietQR" width="220" height="220" />
          </figure>
          <div>
            <dl class="rows">
              ${row("Ngân hàng", sepay.bank, null)}
              ${row("Số tài khoản", sepay.account, sepay.account)}
              ${sepay.accountName && row("Chủ tài khoản", sepay.accountName, null)}
              ${row("Số tiền", `${amount} ₫`, String(order.amount))}
              ${row("Nội dung", order.code, order.code, "key")}
            </dl>
            <p class="hint">
              Nhớ giữ đúng nội dung <b>${order.code}</b> — đó là cách hệ thống
              biết khoản tiền này là của bạn.
            </p>
          </div>
        </div>
        <p id="status" class="${paid ? "status done" : "status"}" role="status">
          <span class="dot"></span
          ><span id="status-text"
            >${
              paid
                ? "Đã nhận thanh toán. Bạn có thể đóng trang này."
                : "Đang chờ chuyển khoản…"
            }</span
          >
        </p>
      </section>
      ${raw(
        arrivalCard({
          title: "Đã cộng credits",
          note: "Credits không bao giờ hết hạn. Quay lại VS Claude để tiếp tục.",
          button: "Đóng",
        })
      )}`,
    html`<script>
      const code = ${json(order.code)}
      const paid = ${json(paid)}
      const status = document.getElementById("status")
      const statusText = document.getElementById("status-text")
      for (const button of document.querySelectorAll("[data-copy]")) {
        button.onclick = async () => {
          try {
            await navigator.clipboard.writeText(button.dataset.copy)
          } catch {
            return
          }
          button.textContent = "Đã chép"
          button.classList.add("copied")
          setTimeout(() => {
            button.textContent = "Sao chép"
            button.classList.remove("copied")
          }, 1500)
        }
      }
      ${raw(arrivalScript("vi-VN"))}
      const poll = async () => {
        try {
          const answer = await (await fetch("/api/orders/" + code)).json()
          if (answer.paid) {
            statusText.textContent =
              "Đã nhận thanh toán. Quay lại VS Claude — credits đã được cộng vào tài khoản."
            status.classList.remove("warn")
            status.classList.add("done")
            showArrival(answer.credits)
            return
          }
          if (answer.short > 0) {
            statusText.textContent =
              "Đã nhận " +
              answer.short.toLocaleString("vi-VN") +
              " ₫, chưa đủ số tiền. Vui lòng liên hệ hỗ trợ."
            status.classList.add("warn")
          }
        } catch {}
        setTimeout(poll, 4000)
      }
      if (!paid) poll()
    </script>`
  )
})
