import { defineHandler } from "nitro"

import { getOrder } from "../../utils/accounts.ts"
import { ARRIVAL_CSS, arrivalCard, arrivalScript } from "../../utils/arrival-page.ts"
import { CREDIT_PACKS, isCreditItem } from "../../utils/billing.ts"
import { qrUrl } from "../../utils/sepay-billing.ts"
import { sepayConfig } from "../../utils/sepay.ts"

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
  const credits = new Intl.NumberFormat("vi-VN").format(
    CREDIT_PACKS[item].credits
  )
  return `Gói ${credits} credits`
}

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] ?? char
  )

export default defineHandler(async (event) => {
  const code = String(event.context.params?.code ?? "").toUpperCase()
  const order = await getOrder(code)
  const sepay = sepayConfig()
  const html = (body: string) =>
    new Response(page(body), {
      status: order ? 200 : 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    })

  if (!order) {
    return html(
      `<h1>Không tìm thấy đơn hàng</h1><p>Hãy bắt đầu lại từ menu tài khoản trong VS Claude.</p>`
    )
  }

  const amount = new Intl.NumberFormat("vi-VN").format(order.amount)
  const qr = qrUrl({
    account: sepay.account,
    bank: sepay.bank,
    amount: order.amount,
    code: order.code,
  })
  return html(`
    <h1>${escape(itemName(order.item))}</h1>
    <p class="muted">Quét mã bằng app ngân hàng — số tiền và nội dung đã điền sẵn.</p>
    <img class="qr" src="${escape(qr)}" alt="Mã VietQR" width="280" height="280">
    <dl>
      <dt>Ngân hàng</dt><dd>${escape(sepay.bank)}</dd>
      <dt>Số tài khoản</dt><dd><b>${escape(sepay.account)}</b></dd>
      ${sepay.accountName ? `<dt>Chủ tài khoản</dt><dd>${escape(sepay.accountName)}</dd>` : ""}
      <dt>Số tiền</dt><dd><b>${amount} ₫</b></dd>
      <dt>Nội dung</dt><dd><b class="code">${escape(order.code)}</b></dd>
    </dl>
    <p id="status" class="status">${
      order.paidBy !== null
        ? "Đã nhận thanh toán. Bạn có thể đóng trang này."
        : "Đang chờ chuyển khoản…"
    }</p>
    ${arrivalCard({
      title: "Đã cộng credits",
      note: "Credits không bao giờ hết hạn. Quay lại VS Claude để tiếp tục.",
      button: "Đóng",
    })}
    <p class="muted small">Nhớ giữ đúng nội dung <b>${escape(order.code)}</b> — đó là cách hệ thống biết khoản tiền này là của bạn.</p>
    <script>
      const code = ${JSON.stringify(order.code)}
      const status = document.getElementById("status")
      ${arrivalScript("vi-VN")}
      const poll = async () => {
        try {
          const answer = await (await fetch("/api/orders/" + code)).json()
          if (answer.paid) {
            status.textContent = "Đã nhận thanh toán. Quay lại VS Claude — credits đã được cộng vào tài khoản."
            status.classList.add("done")
            showArrival(answer.credits)
            return
          }
          if (answer.short > 0) {
            status.textContent = "Đã nhận " + answer.short.toLocaleString("vi-VN") + " ₫, chưa đủ số tiền. Vui lòng liên hệ hỗ trợ."
          }
        } catch {}
        setTimeout(poll, 4000)
      }
      ${order.paidBy === null ? "poll()" : ""}
    </script>
  `)
})

function page(body: string): string {
  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Thanh toán — VS Claude</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      font: 15px/1.5 system-ui, sans-serif; background: #0b0b0f; color: #e8e8ee; }
    main { width: min(26rem, 100% - 2rem); padding: 2rem 0; text-align: center; }
    h1 { font-size: 1.25rem; margin: 0 0 .25rem; }
    .muted { color: #9a9aa8; margin: 0 0 1rem; }
    .small { font-size: .8rem; margin-top: 1rem; }
    .qr { background: #fff; border-radius: 12px; padding: 8px; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: .35rem 1rem;
      text-align: left; margin: 1.25rem 0; padding: 1rem; border-radius: 12px;
      background: #16161d; }
    dt { color: #9a9aa8; }
    dd { margin: 0; word-break: break-all; }
    .code { color: #c4b5fd; letter-spacing: .05em; }
    .status { padding: .75rem; border-radius: 10px; background: #1c1c25; }
    .status.done { background: #133222; color: #86efac; }${ARRIVAL_CSS}
  </style>
</head>
<body><main>${body}</main></body>
</html>`
}
