# Credit

Credit cho phép bạn chat mà không cần tài khoản Claude riêng, hoặc làm tiếp khi
mọi tài khoản của bạn đều hết hạn mức 5 giờ. Không có gói đăng ký: bạn mua một
lần và credit **không bao giờ hết hạn**.

Dùng tài khoản Claude của bạn thì vẫn miễn phí. Credit chỉ bị trừ cho những chat
bạn chuyển sang credit.

## Đăng nhập

Credit gắn với một tài khoản Google, nên bạn cần đăng nhập một lần:

1. Bấm **Sign in with Google**: trong menu tài khoản, trong **Settings ›
   Claude**, hoặc trên thông báo hiện ra khi một chat cần credit.
2. Trình duyệt sẽ mở ra. Đăng nhập Google ở đó.
3. Quay lại ứng dụng. Bạn vẫn đăng nhập kể cả sau khi khởi động lại.

## Mua credit

Bấm **Buy credits** trong menu tài khoản, chọn gói và cách thanh toán:

- **Chuyển khoản (VietQR)**: quét mã QR bằng app ngân hàng.
- **Thẻ**: thẻ quốc tế bất kỳ.

| Bạn trả   | Nhận được (credit) | Ghi chú          |
| --------- | ------------------ | ---------------- |
| 20.000 ₫  | $10                | Chỉ chuyển khoản |
| 50.000 ₫  | $25                |                  |
| 100.000 ₫ | $55                | Tặng thêm 10%    |
| 200.000 ₫ | $120               | Tặng thêm 20%    |

Credit được cộng ngay khi thanh toán xong, và ứng dụng sẽ báo cho bạn.

## Chat bằng credit

Mở menu **Account** của chat và chọn **Pay with credits**. Chat mới bắt đầu với
Haiku, model rẻ nhất; bạn có thể chọn Sonnet hay Opus trong menu model bất cứ
lúc nào.

## Mỗi câu trả lời tốn bao nhiêu

Credit tính bằng đô la theo đúng bảng giá niêm yết của Anthropic, và mỗi model
trừ theo giá riêng: Sonnet gấp 20 lần Haiku, Opus gấp 40 lần. Mỗi câu trả lời
chạy bằng credit đều ghi rõ đã trừ bao nhiêu, nên bạn không phải đoán.

Ước chừng, một lần gọi Sonnet với prompt phần lớn đã cache tốn khoảng
$0,01–0,015, và một tin nhắn Claude Code thường gọi vài lần như vậy. Haiku chỉ
tốn một phần hai mươi, Opus gấp đôi.

::: tip
Cuộc chat càng dài thì mỗi tin nhắn càng tốn, vì toàn bộ cuộc chat được gửi đi
mỗi lần. Khi dùng credit, chat sẽ tự được thu gọn (compact) trước khi vượt quá
100K token.
:::

## Yêu cầu của bạn đi đâu

Khi dùng credit, yêu cầu đi qua server của VS Claude đến Anthropic, đó là cách
chúng được tính phí. Thông tin đăng nhập của bạn không bao giờ được chuyển tiếp.
Khi dùng tài khoản riêng, yêu cầu đi thẳng từ ứng dụng đến Anthropic, không qua
server.
