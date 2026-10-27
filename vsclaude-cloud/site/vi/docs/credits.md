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
| 20.000 ₫  | $0,667             | Chỉ chuyển khoản |
| 50.000 ₫  | $1,67              |                  |
| 100.000 ₫ | $3,67              | Tặng thêm 10%    |
| 200.000 ₫ | $8,00              | Tặng thêm 20%    |

Credit được cộng ngay khi thanh toán xong, và ứng dụng sẽ báo cho bạn.

## Chat bằng credit

Mở menu **Account** của chat và chọn **Pay with credits**. Chat bằng credit được
trả lời bởi **DeepSeek**, không phải Claude: Claude Code vẫn chạy chat, nhưng
model phía sau là của DeepSeek. Chat mới bắt đầu với **DeepSeek Flash**, model
rẻ hơn; bạn có thể chọn **DeepSeek V4 Pro** trong menu model khi cần suy luận
mạnh hơn.

DeepSeek không đọc được file PDF, nên chat bằng credit sẽ lỗi nếu được yêu cầu
đọc một file PDF.

## Mỗi câu trả lời tốn bao nhiêu

Credit tính bằng đô la theo đúng bảng giá niêm yết của DeepSeek, và mỗi model
trừ theo giá riêng: V4 Pro đắt khoảng gấp bốn lần Flash. Mỗi câu trả lời chạy
bằng credit đều ghi rõ đã trừ bao nhiêu, nên bạn không phải đoán.

Ước chừng, một lần gọi Flash với prompt phần lớn đã cache tốn khoảng $0,002, và
một tin nhắn Claude Code thường gọi vài lần như vậy. V4 Pro khoảng $0,006 mỗi
lần gọi.

::: tip
Cuộc chat càng dài thì mỗi tin nhắn càng tốn, vì toàn bộ cuộc chat được gửi đi
mỗi lần. Khi dùng credit, chat sẽ tự được thu gọn (compact) trước khi vượt quá
100K token.
:::

## Yêu cầu của bạn đi đâu

Khi dùng credit, yêu cầu đi qua server của Vey Studio đến DeepSeek, đó là cách
chúng được tính phí. Vì vậy những gì bạn gửi trong chat bằng credit, kể cả code,
được xử lý trên server của DeepSeek. Thông tin đăng nhập của bạn không bao giờ
được chuyển tiếp. Khi dùng tài khoản Claude riêng, yêu cầu đi thẳng từ ứng dụng
đến Anthropic, không qua server.
